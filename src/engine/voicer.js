/**
 * Re-voice a chord for a target instrument group.
 *
 * Strategy: each target defines a list of "slots" — each slot has a center
 * MIDI note and a priority index into the chord tones (0=root, 1=3rd/2nd,
 * 2=5th/4th, 3=7th).  nearestInOctave() finds which octave of that chord
 * tone lands closest to the slot center.
 *
 * This produces natural orchestral register spreading with heavy doubling on
 * the root, less on the 5th, least on the 3rd — without needing to know the
 * exact key in advance.
 */

// Find the MIDI note with pitch class `pc` nearest to `center`
function nearestInOctave(pc, center) {
  return Math.round((center - pc) / 12) * 12 + pc
}

function clamp(n) { return Math.max(12, Math.min(108, n)) }

// priority index → chord tone index (0=root, 1=3rd, 2=5th, 3=7th)
// intervals are already sorted [0, 3/4, 7, 10/11]
const PRIO = [0, 1, 2, 3]

function buildFromSlots(rootPc, intervals, slots) {
  // chord tone pitch classes in priority order: root, 3rd, 5th, 7th
  const tones = intervals.map(i => (rootPc + i) % 12)
  const notes = new Set()

  for (const { prio, center } of slots) {
    const idx = Math.min(prio, tones.length - 1)
    const pc = tones[idx]
    const midi = clamp(nearestInOctave(pc, center))
    notes.add(midi)
  }

  return Array.from(notes).sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------
// Target definitions
// ---------------------------------------------------------------------------

// Full Orchestra — A1 up to ~C6, heavy doublings on root and 5th
const ORCHESTRA_SLOTS = [
  { prio: 0, center: 21 },   // root  ~ A1 (sub-bass anchor)
  { prio: 0, center: 33 },   // root  ~ A2 (bass)
  { prio: 2, center: 40 },   // 5th   ~ E3
  { prio: 0, center: 45 },   // root  ~ A3
  { prio: 1, center: 48 },   // 3rd   ~ C4
  { prio: 2, center: 52 },   // 5th   ~ E4
  { prio: 0, center: 57 },   // root  ~ A4
  { prio: 2, center: 64 },   // 5th   ~ E5
  { prio: 0, center: 69 },   // root  ~ A5
]

// String Ensemble — tighter, A2–A4
const STRINGS_SLOTS = [
  { prio: 0, center: 33 },   // root  ~ A2 (cello bass)
  { prio: 2, center: 40 },   // 5th   ~ E3
  { prio: 0, center: 45 },   // root  ~ A3 (viola)
  { prio: 1, center: 52 },   // 3rd   ~ E4
  { prio: 2, center: 57 },   // 5th   ~ A4 (violin)
  { prio: 0, center: 64 },   // root  ~ E5 (top)
]

// Brass — punchy Bb2–Bb4 register, typically open voicing
const BRASS_SLOTS = [
  { prio: 0, center: 34 },   // root  ~ Bb2 (tuba)
  { prio: 2, center: 41 },   // 5th   ~ F3
  { prio: 0, center: 46 },   // root  ~ Bb3 (trombone)
  { prio: 1, center: 50 },   // 3rd   ~ D4
  { prio: 2, center: 53 },   // 5th   ~ F4 (horn)
  { prio: 0, center: 58 },   // root  ~ Bb4 (trumpet)
]

// Choir SATB — C3–G5, 4 close voices
const CHOIR_SLOTS = [
  { prio: 0, center: 45 },   // Bass   ~ A3 (root)
  { prio: 2, center: 52 },   // Tenor  ~ E4 (5th)
  { prio: 0, center: 57 },   // Alto   ~ A4 (root)
  { prio: 1, center: 60 },   // Soprano~ C5 (3rd)
]

// Piano — root in left hand (A2), full chord in right (A3–E5)
const PIANO_SLOTS = [
  { prio: 0, center: 33 },   // LH root
  { prio: 2, center: 40 },   // LH 5th
  { prio: 0, center: 45 },   // RH root
  { prio: 1, center: 52 },   // RH 3rd
  { prio: 2, center: 57 },   // RH 5th
  { prio: 0, center: 64 },   // RH top
]

export const TARGETS = {
  orchestra: { label: 'Full Orchestra', slots: ORCHESTRA_SLOTS },
  strings:   { label: 'String Ensemble', slots: STRINGS_SLOTS },
  brass:     { label: 'Brass',           slots: BRASS_SLOTS },
  choir:     { label: 'Choir (SATB)',    slots: CHOIR_SLOTS },
  piano:     { label: 'Piano',           slots: PIANO_SLOTS },
}

export function voiceChord(rootPc, intervals, targetKey) {
  const target = TARGETS[targetKey] || TARGETS.orchestra
  if (!intervals || intervals.length === 0) return []
  return buildFromSlots(rootPc, intervals, target.slots)
}

// ---------------------------------------------------------------------------
// Simple voice leading: for each slot position, slide to nearest octave of
// the new chord tone rather than jumping.  Applied between consecutive events.
// ---------------------------------------------------------------------------
export function applyVoiceLeading(prevVoiced, nextVoiced) {
  if (!prevVoiced || prevVoiced.length === 0) return nextVoiced
  if (nextVoiced.length === 0) return nextVoiced

  // For each note in nextVoiced, find nearest octave relative to prevVoiced centroid
  const prevCentroid = prevVoiced.reduce((s, n) => s + n, 0) / prevVoiced.length

  return nextVoiced
    .map(midi => {
      const pc = midi % 12
      // find nearest octave to prevCentroid
      const nearest = nearestInOctave(pc, Math.round(prevCentroid))
      return clamp(nearest)
    })
    .sort((a, b) => a - b)
}

export function voiceEvents(events, targetKey) {
  let prevVoiced = null
  return events.map((ev, i) => {
    if (!ev.chord || ev.chord.quality === 'unknown') {
      return { ...ev, voiced: ev.notes.map(n => n.midi) }
    }
    const raw = voiceChord(ev.chord.rootPc, ev.chord.intervals, targetKey)
    const voiced = i === 0 ? raw : applyVoiceLeading(prevVoiced, raw)
    prevVoiced = voiced
    return { ...ev, voiced }
  })
}
