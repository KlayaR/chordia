/**
 * Physical-constraint + Nolly-voicing rules engine for drums (ported from
 * MidiHuman). Detects each note's role, assigns a Nolly target, applies the
 * kit's micro-dynamics (double-kick swing, tom-hand alternation, fill
 * crescendo), humanizes timing, then voices toward target. Velocity and timing
 * scale independently (0..1).
 */
import { VoiceType, Limb } from './drumMaps.js'
import { mean, clip } from './rng.js'
import * as prof from './nollyProfile.js'

const limbLabel = (limb) =>
  limb.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')

const clampVel = (v) => Math.trunc(Math.max(1, Math.min(prof.VELOCITY_CEILING, Math.round(v))))
const active = (ctx) => ctx.notes.filter((n) => !n.removed)

function recomputeTimes(ctx) {
  for (const n of ctx.notes) n.timeMs = ctx.tempoMap.tickToMs(n.tick)
}
function shiftMs(ctx, note, ms) {
  note.tick = Math.max(0, Math.round(note.tick + ctx.tempoMap.msDeltaToTicks(ms, note.tick)))
  note.timeMs = ctx.tempoMap.tickToMs(note.tick)
}
const beatFrac = (n) => n.beat - Math.floor(n.beat)
function isDownbeat(n, tol = 0.08) { const f = beatFrac(n); return f < tol || f > 1 - tol }
function isBackbeat(n, tol = 0.1) {
  return (beatFrac(n) < tol || beatFrac(n) > 1 - tol) && [2, 4].includes(Math.round(n.beat))
}

function ouSeries(rng, n, step, decay, clipVal) {
  const vals = [0]
  for (let i = 0; i < Math.max(1, n) + 1; i++) {
    const v = vals[vals.length - 1] * decay + rng.normal(0, step)
    vals.push(Math.max(-clipVal, Math.min(clipVal, v)))
  }
  return vals
}
function seriesAt(vals, x) {
  if (x <= 0) return vals[0]
  const i = Math.trunc(x)
  if (i + 1 >= vals.length) return vals[vals.length - 1]
  return vals[i] * (1 - (x - i)) + vals[i + 1] * (x - i)
}

function clustersByMs(notes, windowMs) {
  const sorted = [...notes].sort((a, b) => a.timeMs - b.timeMs)
  const out = []; let cur = []
  for (const n of sorted) {
    if (!cur.length || n.timeMs - cur[0].timeMs <= windowMs) cur.push(n)
    else { out.push(cur); cur = [n] }
  }
  if (cur.length) out.push(cur)
  return out
}
function runsByGap(notes, maxGapTicks) {
  const sorted = [...notes].sort((a, b) => a.tick - b.tick)
  const out = []; let cur = []
  for (const n of sorted) {
    if (!cur.length || n.tick - cur[cur.length - 1].tick <= maxGapTicks) cur.push(n)
    else { out.push(cur); cur = [n] }
  }
  if (cur.length) out.push(cur)
  return out
}

// --- Rule 1: limb conflict resolution --------------------------------------
function ruleLimbConflict(ctx) {
  const { reporter: rep, rng, timeIntensity: It } = ctx
  recomputeTimes(ctx)
  ctx.doublePedal = ctx.drumMap.hasLeftFootKick() &&
    active(ctx).some((n) => n.voice && n.voice.isKick && n.voice.limb === Limb.LEFT_FOOT)

  for (const cluster of clustersByMs(active(ctx), 10)) {
    if (cluster.length < 2) continue
    const hhOpen = cluster.filter((n) => n.voice && n.voice.isHhOpen && !n.removed)
    const hhClosed = cluster.filter((n) => n.voice && n.voice.isHhClosed && !n.removed)
    if (hhOpen.length && hhClosed.length) {
      const ordered = [...hhOpen, ...hhClosed].sort((a, b) => b.velocity - a.velocity)
      for (const victim of ordered.slice(1)) {
        victim.removed = true
        rep.log('Limb conflict', `HH open + closed together — removed ${victim.voice.name}.`,
          victim.bar, victim.beat, { countKey: 'Limb conflict' })
      }
    }
    const byLimb = new Map()
    for (const n of cluster) {
      if (n.removed || !n.voice || n.voice.isKick) continue
      if (!byLimb.has(n.voice.limb)) byLimb.set(n.voice.limb, [])
      byLimb.get(n.voice.limb).push(n)
    }
    for (const [limb, group] of byLimb) {
      if (group.length < 2) continue
      group.sort((a, b) => b.velocity - a.velocity)
      const keeper = group[0]
      for (const victim of group.slice(1)) {
        const delay = rng.uniform(15, 30) * It
        shiftMs(ctx, victim, delay)
        rep.log('Limb conflict',
          `${limbLabel(limb)} conflict: kept ${keeper.voice.name}, delayed ${victim.voice.name} ${delay.toFixed(0)}ms.`,
          victim.bar, victim.beat, { countKey: 'Limb conflict' })
      }
    }
  }
}

// --- Rule 2: classify roles ------------------------------------------------
function ruleClassifyRoles(ctx) {
  for (const n of active(ctx)) {
    const v = n.voice
    if (!v) { n.role = ''; continue }
    if (v.isKick) n.role = 'kick'
    else if (v.vtype === VoiceType.SNARE) n.role = isBackbeat(n) ? 'snare_backbeat' : 'snare_accent'
    else if (v.vtype === VoiceType.SIDESTICK) n.role = 'snare_accent'
    else if (v.isHihat) {
      if (v.isHhPedal) n.role = 'hat_pedal'
      else if (v.isHhOpen) n.role = 'hat_open'
      else n.role = isDownbeat(n) ? 'hat_closed_accent' : 'hat_closed'
    } else if (v.isCrash) n.role = 'crash'
    else if (v.vtype === VoiceType.RIDE) n.role = v.name.toLowerCase().includes('bell') ? 'ride_bell' : 'ride_bow'
    else if (v.vtype === VoiceType.CYMBAL) n.role = 'crash'
    else if (v.isTom) n.role = 'tom_open'
    else n.role = ''
  }
}

// --- Rule 3: double-kick dynamics ------------------------------------------
function ruleDoubleKick(ctx) {
  const { reporter: rep, rng, timeIntensity: It } = ctx
  recomputeTimes(ctx)
  const kicks = active(ctx).filter((n) => n.voice && n.voice.isKick)
  if (kicks.length < 2) return
  const base = prof.target('kick').vel
  const runs = runsByGap(kicks, ctx.ppq * 0.6)

  for (const run of runs) {
    if (run.length < 2) continue
    const bpm = ctx.tempoMap.bpmAt(run[0].tick)
    const twoFoot = new Set(run.map((n) => n.voice.limb)).size > 1
    const swing = rng.uniform(prof.KICK_SWING_MIN, prof.KICK_SWING_MAX)
    let kind
    if (run.length === 2) {
      run[0].targetVel = base - swing
      run[1].targetVel = base
      kind = 'single-foot double'
    } else if (run.length <= 4) {
      const lo = base - prof.KICK_TRIPLE_RISE
      run.forEach((n, i) => { n.targetVel = lo + (prof.KICK_TRIPLE_RISE + 4) * (i / (run.length - 1)) })
      kind = `ascending ${run.length}`
    } else if (twoFoot) {
      const leadLimb = Limb.RIGHT_FOOT
      for (const n of run) n.targetVel = base - (n.voice.limb !== leadLimb ? swing : 0)
      kind = 'two-foot alternating'
    } else {
      run.forEach((n, i) => { n.targetVel = base - (i % 2 === 0 ? swing : 0) })  // first hit = weak
      kind = 'single-foot run'
    }
    for (const n of run) { n.role = 'kick'; n.targetSpread = 4 }
    for (const n of run.slice(1)) shiftMs(ctx, n, rng.uniform(2, 6) * It)

    const vmax = Math.max(...run.map((n) => n.targetVel))
    const vmin = Math.min(...run.map((n) => n.targetVel))
    rep.log('Double kick',
      `Double-kick run, ${run.length} hits at ${bpm.toFixed(0)} BPM (${kind}). Voiced ~${vmin.toFixed(0)}-${vmax.toFixed(0)}.`,
      run[0].bar, run[0].beat, { countKey: 'Double kick' })
  }
}

// --- Rule 4: fill detection + crescendo ------------------------------------
function ruleFill(ctx) {
  const { reporter: rep, rng, timeIntensity: It } = ctx
  recomputeTimes(ctx)
  const notes = active(ctx).sort((a, b) => a.tick - b.tick)
  if (notes.length < 4) return

  const barCounts = {}
  for (const n of notes) barCounts[n.bar] = (barCounts[n.bar] || 0) + 1
  const isCand = (n) => !!(n.voice && (n.voice.isTom || n.voice.vtype === VoiceType.SNARE))

  const runs = []; let cur = []
  for (const n of notes) {
    if (isCand(n)) {
      if (!cur.length || n.tick - cur[cur.length - 1].tick <= ctx.ppq) cur.push(n)
      else { runs.push(cur); cur = [n] }
    } else if (cur.length) { runs.push(cur); cur = [] }
  }
  if (cur.length) runs.push(cur)

  for (const run of runs) {
    if (run.length < 4) continue
    if (new Set(run.map((n) => n.note)).size < 2) continue   // single-drum ostinato
    const b0 = run[0].bar, b1 = run[run.length - 1].bar
    if (b1 - b0 > 1) continue
    const runDensity = run.length / (b1 - b0 + 1)
    const surr = []
    for (let b = b0 - 2; b <= b1 + 2; b++) if ((b < b0 || b > b1) && b >= 1) surr.push(b)
    const surrDensity = surr.length ? surr.reduce((s, b) => s + (barCounts[b] || 0), 0) / surr.length : 0
    if (surrDensity > 0 && runDensity < 2 * surrDensity) continue

    const N = run.length
    run.forEach((n, i) => {
      n.isFill = true
      n.role = (n.voice && n.voice.vtype === VoiceType.SNARE) ? 'snare_fill' : 'tom_fast'
      const frac = N > 1 ? i / (N - 1) : 1
      n.targetVel = prof.FILL_START + (prof.FILL_FINAL - prof.FILL_START) * frac
      n.targetSpread = 5
      if (i >= Math.trunc(N * 0.75)) shiftMs(ctx, n, -rng.uniform(2, 5) * (i - Math.trunc(N * 0.75) + 1) * It)
    })
    run[N - 1].targetVel = prof.FILL_FINAL
    run[N - 1].isFillFinal = true
    rep.log('Fill', `Fill, ${N} hits — crescendo to ~${prof.FILL_FINAL.toFixed(0)} final.`,
      b0, run[0].beat, { countKey: 'Fill' })
  }
}

// --- Rule 5: tom-hand alternation (±10) ------------------------------------
function ruleTomHands(ctx) {
  const rep = ctx.reporter
  const toms = active(ctx).filter((n) => n.voice && n.voice.isTom)
  if (toms.length < 2) return
  let touched = 0
  for (const run of runsByGap(toms, ctx.ppq * 1.0)) {
    if (run.length < 2) continue
    run.forEach((n, i) => {
      if (!n.isFill && n.targetVel === null) n.role = 'tom_fast'
      if (n.targetVel === null) n.targetVel = prof.target(n.role || 'tom_fast').vel
      if (i % 2 === 1) n.targetVel -= prof.TOM_HAND_ALT       // off hand quieter (Nolly 100/90)
      touched += 1
    })
  }
  if (touched) {
    rep.log('Tom hands',
      `Hand-to-hand tom alternation (off-hand −${prof.TOM_HAND_ALT.toFixed(0)}) on ${touched} consecutive hits.`,
      0, 1.0, { countKey: 'Tom hands', count: touched })
  }
}

// --- Rule 6: ghost notes and ruffs -----------------------------------------
function ruleGhost(ctx) {
  const { reporter: rep, rng, timeIntensity: It } = ctx
  const snares = active(ctx).filter((n) => n.voice && n.voice.vtype === VoiceType.SNARE)
  if (!snares.length) return
  const avg = mean(snares.map((n) => n.origVelocity))
  const gThresh = Math.min(40, 0.4 * avg)

  const byTick = [...snares].sort((a, b) => a.tick - b.tick)
  for (let i = 0; i < byTick.length - 1; i++) {
    const a = byTick[i], b = byTick[i + 1]
    if (b.tick - a.tick > 0 && b.tick - a.tick <= ctx.ppq / 8 && a.origVelocity <= gThresh + 10) {
      a.isRuff = true; a.role = 'ruff'
    }
  }
  for (const n of snares) {
    if (n.isRuff) continue
    if (n.origVelocity < gThresh) {
      n.isGhost = true; n.role = 'ghost'
      shiftMs(ctx, n, rng.uniform(5, 15) * It)
    }
  }
  const ghosts = snares.filter((n) => n.isGhost).length
  const ruffs = snares.filter((n) => n.isRuff).length
  if (ghosts) rep.log('Ghost note', `${ghosts} ghost snare(s) voiced to ~${prof.target('ghost').vel.toFixed(0)}.`,
    0, 1.0, { countKey: 'Ghost note', count: ghosts })
  if (ruffs) rep.log('Ruff', `${ruffs} ruff/grace note(s) voiced to ~${prof.target('ruff').vel.toFixed(0)}.`,
    0, 1.0, { countKey: 'Ruff', count: ruffs })
}

// --- Rule 7: crash impacts -------------------------------------------------
function ruleCrash(ctx) {
  const { reporter: rep, rng, timeIntensity: It } = ctx
  recomputeTimes(ctx)
  const crashes = active(ctx).filter((n) => n.voice && n.voice.isCrash).sort((a, b) => a.tick - b.tick)
  if (!crashes.length) return
  const fillFinals = active(ctx).filter((n) => n.isFillFinal)
  const notes = active(ctx)
  let impacts = 0, breaths = 0
  const window = prof.PREIMPACT_WINDOW_BEATS * ctx.ppq

  for (const n of crashes) {
    const onBeat1 = Math.abs(n.beat - 1.0) < 0.12
    const afterFill = fillFinals.some((ff) => n.timeMs - ff.timeMs >= 0 && n.timeMs - ff.timeMs <= 350)
    if (onBeat1 || afterFill) { n.targetVel = prof.target('crash').vel; impacts += 1 }
    else n.targetVel = prof.target('crash').vel - 7

    if (onBeat1 && !afterFill) {
      for (const m of notes) {
        if (m.role && !m.isFill && n.tick - m.tick > 0 && n.tick - m.tick <= window) {
          const base = m.targetVel !== null ? m.targetVel : prof.target(m.role).vel
          m.targetVel = base * prof.PREIMPACT_DIP
          breaths += 1
        }
      }
    }
  }
  if (breaths) rep.log('Build-up',
    `Pre-impact breath: ${breaths} hit(s) eased before a section crash so it lands harder.`,
    0, 1.0, { countKey: 'Build-up', count: breaths })

  if (ctx.drumMap.crashCount() <= 1) {
    for (const cluster of clustersByMs(crashes, 100)) {
      if (cluster.length < 2) continue
      cluster.sort((a, b) => (b.targetVel || 0) - (a.targetVel || 0))
      for (const victim of cluster.slice(1)) shiftMs(ctx, victim, rng.uniform(80, 120) * It)
    }
  }
  if (impacts) rep.log('Crash', `${impacts} impact crash(es) voiced to ~${prof.target('crash').vel.toFixed(0)}.`,
    0, 1.0, { countKey: 'Crash', count: impacts })
}

// --- Rule 8: timing feel ---------------------------------------------------
function ruleGlobalTiming(ctx) {
  const { reporter: rep, rng, timeIntensity: It } = ctx
  const notes = active(ctx)
  if (It <= 0 || !notes.length) return
  const maxBeat = Math.max(...notes.map((n) => n.tick)) / ctx.ppq
  const drift = ouSeries(rng, Math.trunc(maxBeat) + 2, prof.DRIFT_STEP, prof.DRIFT_DECAY, prof.DRIFT_MAX)
  const feelBias = prof.FEEL_MAX * ctx.feel

  for (const n of notes) {
    const beatpos = n.tick / ctx.ppq
    const [lay, fweight] = prof.feelOf(n.role)
    const anchor = !!(n.voice && n.voice.isKick && Math.abs(n.beat - 1.0) < 0.1)
    n.lockedTiming = anchor
    const sd = prof.JITTER_MS * (anchor ? prof.ANCHOR_JITTER : 1.0)
    const jit = clip(rng.normal(0, sd), -prof.JITTER_MAX, prof.JITTER_MAX)
    const offset = (seriesAt(drift, beatpos) + lay + feelBias * fweight + jit) * It
    if (Math.abs(offset) < 0.01) continue
    shiftMs(ctx, n, offset)
    rep.addTiming(offset)
  }
  const fl = ctx.feel > 0.05 ? 'laid-back' : ctx.feel < -0.05 ? 'pushing' : 'neutral'
  rep.log('Timing',
    `Groove feel applied: per-voice pocket + kit drift (±${prof.DRIFT_MAX.toFixed(0)}ms), feel = ${fl} (${(ctx.feel * 100).toFixed(0)}%).`,
    0, 1.0, { countKey: '_timing_feel' })
}

// --- Rule 9: voicing -------------------------------------------------------
function ruleVoicing(ctx) {
  const { reporter: rep, rng, velIntensity: Iv } = ctx
  const notes = active(ctx)
  const maxBeat = notes.length ? Math.max(...notes.map((n) => n.tick)) / ctx.ppq : 0
  const swell = ouSeries(rng, Math.trunc(maxBeat) + 2, prof.VEL_DRIFT_STEP, prof.VEL_DRIFT_DECAY, prof.VEL_DRIFT_MAX)
  let voiced = 0, capped = 0
  for (const n of notes) {
    if (!n.voice || !n.role) continue
    const t = prof.target(n.role)
    const tgt = n.targetVel !== null ? n.targetVel : t.vel
    const spread = n.targetSpread !== null ? n.targetSpread : t.spread
    let jit = rng.normal(0, spread)
    if (jit > 0) jit *= prof.UPWARD_JITTER
    const phrase = seriesAt(swell, n.tick / ctx.ppq) * Iv
    let voicedVel = tgt + jit + phrase
    const cap = Math.min(prof.VELOCITY_CEILING, Math.max(t.hi, (n.targetVel ?? 0) + 2))
    if (voicedVel >= cap) capped += 1
    voicedVel = Math.min(voicedVel, cap)
    const final = n.origVelocity + (voicedVel - n.origVelocity) * Iv
    const newV = clampVel(final)
    if (newV !== n.velocity) { n.velocity = newV; voiced += 1 }
  }
  if (voiced) rep.bump('Voicing', voiced)
  rep.log('Voicing',
    `Voiced ${voiced} notes toward Nolly M&M2 targets (backbeat→${prof.target('snare_backbeat').vel.toFixed(0)}, `
    + `closed hat→~${prof.target('hat_closed').vel.toFixed(0)}, kick→~${prof.target('kick').vel.toFixed(0)}). `
    + `${capped} held under the ${prof.VELOCITY_CEILING} ceiling.`,
    0, 1.0, { countKey: '_voicing_summary' })
}

const RULES = [
  ruleLimbConflict, ruleClassifyRoles, ruleDoubleKick, ruleFill, ruleTomHands,
  ruleGhost, ruleCrash, ruleGlobalTiming, ruleVoicing,
]

export function runAll(ctx) {
  for (const rule of RULES) rule(ctx)
  recomputeTimes(ctx)
}
