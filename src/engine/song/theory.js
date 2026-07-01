/**
 * Song-builder music theory: scales, diatonic chords with roman numerals,
 * and chord → MIDI voicing. Everything derives from a key root (pitch class)
 * and a scale, so progressions expressed as scale degrees adapt to any key.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const noteName = (pc) => NOTE_NAMES[((pc % 12) + 12) % 12]

// scales the builder supports (7-note so triads stack cleanly)
export const SCALES = {
  Major:          [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  Dorian:         [0, 2, 3, 5, 7, 9, 10],
  Phrygian:       [0, 1, 3, 5, 7, 8, 10],
  Mixolydian:     [0, 2, 4, 5, 7, 9, 10],
}
export const SCALE_NAMES = Object.keys(SCALES)

// quality -> intervals from the chord root
export const QUALITIES = {
  maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10],
  dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], sus2: [0, 2, 7], sus4: [0, 5, 7],
}

const SUFFIX = {
  maj: '', min: 'm', dim: 'dim', aug: 'aug',
  maj7: 'maj7', min7: 'm7', dom7: '7', dim7: 'dim7', m7b5: 'm7b5', sus2: 'sus2', sus4: 'sus4',
}

export function chordName(rootPc, quality) {
  return `${noteName(rootPc)}${SUFFIX[quality] ?? ''}`
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

function triadQuality(third, fifth) {
  if (third === 4 && fifth === 7) return 'maj'
  if (third === 3 && fifth === 7) return 'min'
  if (third === 3 && fifth === 6) return 'dim'
  if (third === 4 && fifth === 8) return 'aug'
  if (third === 3 && fifth === 8) return 'min'   // odd scales — fall back
  return 'maj'
}

function seventhQuality(base, seventh) {
  // extend a triad quality with the diatonic 7th
  if (base === 'maj') return seventh === 11 ? 'maj7' : 'dom7'
  if (base === 'min') return seventh === 10 ? 'min7' : 'min7'
  if (base === 'dim') return seventh === 9 ? 'dim7' : 'm7b5'
  return 'dom7'
}

function romanFor(degree, quality, seventh) {
  let r = ROMAN[degree]
  const lower = quality === 'min' || quality === 'dim' || quality === 'm7b5' || quality === 'min7'
  if (lower) r = r.toLowerCase()
  if (quality === 'dim' || quality === 'dim7') r += '°'
  else if (quality === 'm7b5') r += 'ø'
  else if (quality === 'aug') r += '+'
  if (seventh) r += '7'
  return r
}

/** The 7 diatonic chords of a key, degree 1..7. */
export function diatonicChords(rootPc, scaleName, { sevenths = false } = {}) {
  const scale = SCALES[scaleName] || SCALES.Major
  const out = []
  for (let i = 0; i < 7; i++) {
    const degRoot = (rootPc + scale[i]) % 12
    const third = ((scale[(i + 2) % 7] - scale[i]) + 12) % 12
    const fifth = ((scale[(i + 4) % 7] - scale[i]) + 12) % 12
    let quality = triadQuality(third, fifth)
    let seventh = null
    if (sevenths) {
      seventh = ((scale[(i + 6) % 7] - scale[i]) + 12) % 12
      quality = seventhQuality(quality, seventh)
    }
    out.push({
      root: degRoot,
      quality,
      intervals: QUALITIES[quality] || QUALITIES.maj,
      name: chordName(degRoot, quality),
      roman: romanFor(i, quality, !!sevenths),
      degree: i + 1,
    })
  }
  return out
}

/** Chord → MIDI notes: a low bass root + a mid-register chord voicing. */
export function voiceChord(chord, { bass = true, octave = 0 } = {}) {
  const base = 60 + chord.root + octave * 12       // root in C4..B4
  const notes = chord.intervals.map((iv) => base + iv)
  if (bass) notes.unshift(base - 12)
  return notes
}

export const ROOT_CHOICES = NOTE_NAMES.map((n, pc) => ({ pc, name: n }))
