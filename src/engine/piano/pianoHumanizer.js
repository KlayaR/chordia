/**
 * Piano humanizer (ported from MidiHuman). Voices a chords+melody MIDI (melody
 * brought out, inner voices recede, bass shaped, phrase swell, accents), then
 * micro-times it (melody lead, bottom-to-top chord roll, hand asynchrony,
 * phrase rubato) and generates a syncopated sustain pedal (CC64).
 */
import { makeRng, mean } from '../drums/rng.js'
import { STYLES, DEFAULT_STYLE, VELOCITY_CEILING } from './pianoStyles.js'

const clamp = (v) => Math.trunc(Math.max(1, Math.min(VELOCITY_CEILING, Math.round(v))))

function ou(rng, n, step, decay, clipVal) {
  const vals = [0]
  for (let i = 0; i < Math.max(1, n); i++) {
    const v = vals[vals.length - 1] * decay + rng.normal(0, step)
    vals.push(Math.max(-clipVal, Math.min(clipVal, v)))
  }
  return vals
}
const isDownbeat = (n) => { const f = n.beat - Math.floor(n.beat); return f < 0.1 || f > 0.9 }

function voicing(parse, style, Iv, rng) {
  const counts = { melody: 0, inner: 0, bass: 0 }
  const swell = ou(rng, parse.events.length, style.dynSwell * 0.5, 0.8, style.dynSwell)
  let prevMel = null
  for (const ev of parse.events) {
    const base = mean(ev.notes.map((n) => n.origVelocity))
    const sw = swell[Math.min(ev.notes[0].eventId, swell.length - 1)]
    for (const n of ev.notes) {
      let v = base + sw
      if (n.role === 'melody') {
        v += style.melodyBoost
        if (prevMel !== null) v += style.contour * Math.max(-6, Math.min(6, (n.note - prevMel) * 0.6))
        prevMel = n.note
        counts.melody += 1
      } else if (n.role === 'bass') {
        v += style.bassAdjust
        counts.bass += 1
      } else {
        v -= style.innerCut
        counts.inner += 1
      }
      if (isDownbeat(n)) v += style.accent
      if (n.phraseEnd && n.role === 'melody') v -= style.dynSwell * 0.6
      v += rng.normal(0, style.velJitter)
      const voiced = clamp(v)
      n.velocity = clamp(n.origVelocity + (voiced - n.origVelocity) * Iv)
    }
  }
  return counts
}

function timing(parse, style, It, rng) {
  if (It <= 0) return 0
  const tm = parse.tempoMap
  let nudges = 0
  for (const ev of parse.events) {
    const handOff = rng.normal(0, style.handAsync)   // one LH offset per event
    ev.notes.forEach((n, rank) => {
      let off = 0
      if (n.role === 'melody') off -= style.melodyLead
      else off += rank * style.chordSpread
      if (n.hand === 'LH') off += handOff
      if (n.phraseEnd) off += style.rubato * 45
      off += rng.normal(0, style.timingJitter)
      off *= It
      if (Math.abs(off) < 0.01) return
      n.start = Math.max(0, Math.round(n.start + tm.msDeltaToTicks(off, n.start)))
      n.timeMs = tm.tickToMs(n.start)
      nudges += 1
    })
  }
  return nudges
}

function pedalGen(parse, style) {
  if (!style.pedal || !parse.notes.length) return []
  const tm = parse.tempoMap, ppq = parse.ppq
  const evs = parse.events
    .map((ev) => [Math.min(...ev.notes.map((n) => n.start)), Math.min(...ev.notes.map((n) => n.note))])
    .sort((a, b) => a[0] - b[0])

  const minGap = ppq / Math.max(1, style.pedalMaxDensity)
  const changes = [evs[0][0]]
  let prevBass = evs[0][1]
  for (let i = 1; i < evs.length; i++) {
    const [tick, bass] = evs[i]
    if (bass !== prevBass && tick - changes[changes.length - 1] >= minGap) changes.push(tick)
    prevBass = bass
  }
  const delay = Math.trunc(tm.msDeltaToTicks(style.pedalDelayMs, changes[0]))
  const pedal = [[Math.max(0, changes[0]), 127]]
  for (let i = 1; i < changes.length; i++) {
    pedal.push([Math.max(0, changes[i] - 2), 0])   // clear old harmony
    pedal.push([changes[i] + delay, 127])          // catch the new one
  }
  const lastOff = Math.max(...parse.notes.map((n) => n.start + n.dur))
  pedal.push([lastOff, 0])
  return pedal
}

export function humanizePiano(parse, styleName = DEFAULT_STYLE, { voicingIntensity = 100, timingIntensity = 75, seed } = {}) {
  const style = STYLES[styleName] || STYLES[DEFAULT_STYLE]
  const rng = makeRng(seed)
  const working = parse.notes.map((n) => ({ ...n }))
  const originalNotes = parse.notes.map((n) => ({ ...n }))

  // rebuild events from the cloned notes, grouped by event id
  const byEv = new Map()
  for (const n of working) {
    if (!byEv.has(n.eventId)) byEv.set(n.eventId, [])
    byEv.get(n.eventId).push(n)
  }
  const events = [...byEv.entries()].sort((a, b) => a[0] - b[0]).map(([, ns]) => {
    ns.sort((a, b) => a.note - b.note)
    return { tick: Math.min(...ns.map((n) => n.start)), notes: ns }
  })
  const wparse = { ...parse, notes: working, events }

  const counts = { notes: working.length, events: events.length, melody: 0, inner: 0, bass: 0, timing: 0 }
  if ((voicingIntensity > 0 || timingIntensity > 0) && working.length) {
    Object.assign(counts, voicing(wparse, style, voicingIntensity / 100, rng))
    counts.timing = timing(wparse, style, timingIntensity / 100, rng)
  }
  const pedal = pedalGen(wparse, style)
  counts.pedal = pedal.length

  return { parse: wparse, notes: working, originalNotes, pedal, styleName: style.name, counts, summaryLines: () => summaryLines(style.name, counts) }
}

function summaryLines(styleName, c) {
  return [
    `✓ ${c.notes || 0} notes · ${c.events || 0} chords · style: ${styleName}`,
    `  → melody line: ${c.melody || 0} notes brought out`,
    `  → ${c.inner || 0} inner voices softened, ${c.bass || 0} bass shaped`,
    `  → ${c.timing || 0} timing nudges (melody lead + chord roll)`,
    `  → sustain pedal: ${c.pedal || 0} CC64 events generated`,
  ]
}

export async function exportPiano(result) {
  const { Midi } = await import('@tonejs/midi')
  const parse = result.parse
  const out = new Midi(parse.midi.toArray())
  const track = out.tracks[parse.trackIndex]
  track.notes.length = 0
  if (track.controlChanges[64]) track.controlChanges[64].length = 0
  for (const n of result.notes) {
    track.addNote({
      midi: n.note,
      ticks: Math.max(0, Math.round(n.start)),
      durationTicks: Math.max(1, Math.round(n.dur)),
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity))) / 127,
    })
  }
  for (const [tick, val] of result.pedal) {
    track.addCC({ number: 64, value: val / 127, ticks: Math.max(0, Math.round(tick)) })
  }
  return out
}

export async function humanizePianoFile(file, styleName = DEFAULT_STYLE, opts = {}) {
  const { parsePiano } = await import('./pianoAnalyze.js')
  const parse = await parsePiano(file, opts.trackIndex ?? null)
  return humanizePiano(parse, styleName, opts)
}
