/**
 * String orchestration by independent voice leading.
 *
 * Each section of the string orchestra is treated as an independent player with
 * a fixed working register and carried-over pitch — NOT a keyboard layer. For
 * every chord we generate candidate voicings, score them by voice-leading cost
 * (common tones held, small steps, contrary motion, no parallels/crossings) and
 * keep the cheapest. The result is one part per section that moves smoothly from
 * chord to chord.
 *
 * Pitches are MIDI numbers in scientific pitch (C4 = 60 = middle C).
 */

// Sections, bottom -> top. Ranges are the practical "working" registers.
const SECTIONS = [
  { id: 'cb', name: 'Contrabass', lo: 28, hi: 43, center: 33 }, // E1–G2
  { id: 'vc', name: 'Cello',      lo: 36, hi: 62, center: 48 }, // C2–D4
  { id: 'va', name: 'Viola',      lo: 48, hi: 67, center: 57 }, // C3–G4
  { id: 'v2', name: 'Violin II',  lo: 55, hi: 74, center: 64 }, // G3–D5
  { id: 'v1', name: 'Violin I',   lo: 60, hi: 88, center: 72 }, // C4–E6
]
const N = SECTIONS.length
const CB = 0
const V1 = N - 1

export const TARGETS = {
  orchestra: { label: 'Full Orchestra', doublings: true },
  strings:   { label: 'String Ensemble', doublings: false },
}

const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0)
const pc = (m) => ((m % 12) + 12) % 12

// ---------------------------------------------------------------------------
// Chord-tone analysis
// ---------------------------------------------------------------------------
function chordInfo(chord) {
  const root = chord.rootPc
  const iv = chord.intervals || []
  const tones = iv.map((i) => pc(root + i))
  const toneSet = new Set(tones)

  const third = iv.length > 1 ? pc(root + iv[1]) : null
  // seventh = a tone 10 or 11 semitones above the root, if present
  let seventh = null
  for (const i of iv) if (i === 10 || i === 11) seventh = pc(root + i)
  // fifth = a tone 6,7,8 semitones above the root
  let fifth = null
  for (const i of iv) if (i === 6 || i === 7 || i === 8) fifth = pc(root + i)

  const mandatory = new Set([root])
  if (third !== null) mandatory.add(third)
  if (seventh !== null) mandatory.add(seventh)

  return { root, third, fifth, seventh, tones, toneSet, mandatory }
}

// MIDI notes inside a section's register whose pitch class is a chord tone.
function allowedPitches(section, toneSet) {
  const out = []
  for (let m = section.lo; m <= section.hi; m++) if (toneSet.has(pc(m))) out.push(m)
  return out
}

// ---------------------------------------------------------------------------
// Candidate generation (backtracking with hard constraints)
// ---------------------------------------------------------------------------
function generateCandidates(info, maxUpperGap = 12) {
  const allowed = SECTIONS.map((s) => allowedPitches(s, info.toneSet))
  if (allowed.some((a) => a.length === 0)) return []

  const results = []
  const chosen = new Array(N)

  function recurse(idx) {
    if (idx === N) {
      const pcs = chosen.map(pc)
      for (const need of info.mandatory) if (!pcs.includes(need)) return
      results.push(chosen.slice())
      return
    }
    for (const p of allowed[idx]) {
      if (idx > 0) {
        const below = chosen[idx - 1]
        if (p < below) continue                       // no crossing
        const gap = p - below
        if (idx === 1) {                              // CB -> Cello: avoid low mud
          if (gap < 4) continue
        } else if (gap > maxUpperGap) {               // upper voices stay within an 8ve
          continue
        }
      }
      chosen[idx] = p
      recurse(idx + 1)
    }
  }
  recurse(0)
  return results
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
function isParallelPerfect(pi, pj, ci, cj) {
  const di = ci - pi
  const dj = cj - pj
  if (di === 0 || dj === 0) return false
  if (sign(di) !== sign(dj)) return false
  const before = Math.abs(pi - pj) % 12
  const after = Math.abs(ci - cj) % 12
  return (before === 7 && after === 7) || (before === 0 && after === 0)
}

function isHiddenOuter(pb, pt, cb, ct) {
  const db = cb - pb
  const dt = ct - pt
  if (db === 0 || dt === 0) return false
  if (sign(db) !== sign(dt)) return false   // only similar motion
  if (Math.abs(dt) <= 2) return false        // top voice moved by step → acceptable
  const after = Math.abs(cb - ct) % 12
  return after === 7 || after === 0
}

function staticScore(cand, info) {
  // Used for the first chord (no previous voicing). Prefer each voice near its
  // section centre, root in the bass, open low spacing.
  let s = 0
  for (let i = 0; i < N; i++) s += Math.abs(cand[i] - SECTIONS[i].center) * 0.5
  if (pc(cand[CB]) !== info.root) s += 6      // root in the bass
  if (cand[1] - cand[CB] < 7) s += 4          // want >= a 5th at the bottom
  return s
}

function transitionScore(prev, cand, info) {
  let s = 0

  for (let i = 0; i < N; i++) {
    const move = Math.abs(cand[i] - prev[i])
    s += move
    if (move === 0) s -= 2.5                   // reward common-tone retention
    else if (move > 4) s += (move - 4) * 3     // penalise leaps beyond a major 3rd
  }

  // parallel 5ths / octaves (any pair) — near-forbidden
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++)
      if (isParallelPerfect(prev[i], prev[j], cand[i], cand[j])) s += 1000

  // hidden 5th / octave between the outer voices
  if (isHiddenOuter(prev[CB], prev[V1], cand[CB], cand[V1])) s += 120

  // overlap: a voice rising above where the voice above it just was
  for (let i = 0; i < N - 1; i++) if (cand[i] > prev[i + 1]) s += 80

  // reward contrary motion between the outer voices
  const db = sign(cand[CB] - prev[CB])
  const dt = sign(cand[V1] - prev[V1])
  if (db !== 0 && dt !== 0 && db !== dt) s -= 6

  s += spacingAndDoubling(cand, info)
  return s
}

function spacingAndDoubling(cand, info) {
  let s = 0
  const pcs = cand.map(pc)

  // bass character: root best, fifth ok, third = 1st inversion (mild), 7th avoid
  if (pcs[CB] === info.root) s -= 3
  else if (info.fifth !== null && pcs[CB] === info.fifth) s += 2
  else if (info.third !== null && pcs[CB] === info.third) s += 6
  else s += 14                                 // 7th or extension in the bass

  // doubling: reward a doubled root, discourage doubling the 3rd / leading tone
  const rootCount = pcs.filter((p) => p === info.root).length
  if (rootCount >= 2) s -= 3
  if (info.third !== null && pcs.filter((p) => p === info.third).length >= 2) s += 16
  if (info.seventh !== null && pcs.filter((p) => p === info.seventh).length >= 2) s += 12

  // discourage dense mid-range stacking (va/v2/cello inside one octave)
  if (cand[3] - cand[1] < 12) s += 5

  // discourage unisons between adjacent voices
  for (let i = 0; i < N - 1; i++) if (cand[i] === cand[i + 1]) s += 8

  return s
}

// ---------------------------------------------------------------------------
// Solve one chord
// ---------------------------------------------------------------------------
function solveChord(info, prev) {
  let cands = generateCandidates(info, 12)
  if (cands.length === 0) cands = generateCandidates(info, 15)   // relax spacing
  if (cands.length === 0) return fallbackVoicing(info)

  let best = null
  let bestCost = Infinity
  for (const c of cands) {
    const cost = prev ? transitionScore(prev, c, info) : staticScore(c, info)
    if (cost < bestCost) { bestCost = cost; best = c }
  }
  return best
}

// Last resort: nearest octave of a chord tone to each section centre.
function fallbackVoicing(info) {
  return SECTIONS.map((s) => {
    let best = s.center
    let bestD = Infinity
    for (let m = s.lo; m <= s.hi; m++) {
      if (!info.toneSet.has(pc(m))) continue
      const d = Math.abs(m - s.center)
      if (d < bestD) { bestD = d; best = m }
    }
    return best
  })
}

// ---------------------------------------------------------------------------
// Doublings for the fuller "orchestra" target
// ---------------------------------------------------------------------------
function withDoublings(voicing) {
  const out = new Set(voicing)
  const bassOct = voicing[CB] + 12     // basses + celli an octave apart
  if (bassOct <= 60) out.add(bassOct)
  const topOct = voicing[V1] + 12      // violins octave on top
  if (topOct <= 96) out.add(topOct)
  return Array.from(out).sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function voiceEvents(events, targetKey) {
  const target = TARGETS[targetKey] || TARGETS.orchestra
  let prev = null
  return events.map((ev) => {
    if (!ev.chord || ev.chord.quality === 'unknown' || !ev.chord.intervals?.length) {
      prev = null
      return { ...ev, voiced: ev.notes.map((n) => n.midi) }
    }
    const info = chordInfo(ev.chord)
    const voicing = solveChord(info, prev)
    prev = voicing
    const voiced = target.doublings ? withDoublings(voicing) : voicing.slice()
    return { ...ev, voiced }
  })
}

// Exposed for tests / debugging
export { SECTIONS, chordInfo, solveChord }
