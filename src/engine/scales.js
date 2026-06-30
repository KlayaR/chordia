/**
 * Scale detection engine (ported from the MidiHuman Python tool).
 *
 *  1. find scales that CONTAIN a set of selected pitch classes (clicked keys),
 *     narrowing as more notes are added.
 *  2. detect the most likely scale/key from a MIDI file (or a 12-bin pitch-class
 *     weight histogram) via Krumhansl-style template correlation.
 *
 * Everything works in pitch-class space (0–11); octaves don't matter.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const noteName = (pc) => NOTE_NAMES[((pc % 12) + 12) % 12]

// [display name, intervals from root, priority] — lower priority sorts first.
const SCALE_DEFS = [
  ['Major (Ionian)', [0, 2, 4, 5, 7, 9, 11], 1],
  ['Natural Minor (Aeolian)', [0, 2, 3, 5, 7, 8, 10], 1],
  ['Dorian', [0, 2, 3, 5, 7, 9, 10], 2],
  ['Phrygian', [0, 1, 3, 5, 7, 8, 10], 2],
  ['Lydian', [0, 2, 4, 6, 7, 9, 11], 2],
  ['Mixolydian', [0, 2, 4, 5, 7, 9, 10], 2],
  ['Locrian', [0, 1, 3, 5, 6, 8, 10], 2],
  ['Major Pentatonic', [0, 2, 4, 7, 9], 2],
  ['Minor Pentatonic', [0, 3, 5, 7, 10], 2],
  ['Egyptian (Suspended) Pentatonic', [0, 2, 5, 7, 10], 4],
  ['Blues Minor Pentatonic (Man Gong)', [0, 3, 5, 8, 10], 4],
  ['Blues Major (Ritusen/Yo)', [0, 2, 5, 7, 9], 4],
  ['Hirajoshi', [0, 2, 3, 7, 8], 5],
  ['Insen', [0, 1, 5, 7, 10], 5],
  ['Iwato', [0, 1, 5, 6, 10], 5],
  ['Kumoi', [0, 2, 3, 7, 9], 5],
  ['Balinese Pelog', [0, 1, 3, 7, 8], 5],
  ['Blues (Minor Blues)', [0, 3, 5, 6, 7, 10], 2],
  ['Major Blues', [0, 2, 3, 4, 7, 9], 3],
  ['Whole Tone', [0, 2, 4, 6, 8, 10], 3],
  ['Augmented', [0, 3, 4, 7, 8, 11], 4],
  ['Prometheus', [0, 2, 4, 6, 9, 10], 5],
  ['Tritone', [0, 1, 4, 6, 7, 10], 5],
  ['Harmonic Minor', [0, 2, 3, 5, 7, 8, 11], 3],
  ['Phrygian Dominant', [0, 1, 4, 5, 7, 8, 10], 3],
  ['Locrian ♮6', [0, 1, 3, 5, 6, 9, 10], 5],
  ['Ionian #5 (Augmented Major)', [0, 2, 4, 5, 8, 9, 11], 5],
  ['Dorian #4 (Ukrainian/Romanian)', [0, 2, 3, 6, 7, 9, 10], 5],
  ['Lydian #2', [0, 3, 4, 6, 7, 9, 11], 5],
  ['Ultralocrian', [0, 1, 3, 4, 6, 8, 9], 6],
  ['Melodic Minor (Jazz Minor)', [0, 2, 3, 5, 7, 9, 11], 3],
  ['Dorian b2', [0, 1, 3, 5, 7, 9, 10], 5],
  ['Lydian Augmented', [0, 2, 4, 6, 8, 9, 11], 5],
  ['Lydian Dominant (Acoustic)', [0, 2, 4, 6, 7, 9, 10], 4],
  ['Mixolydian b6 (Melodic Major)', [0, 2, 4, 5, 7, 8, 10], 4],
  ['Half-Diminished (Locrian ♮2)', [0, 2, 3, 5, 6, 8, 10], 4],
  ['Altered (Super Locrian)', [0, 1, 3, 4, 6, 8, 10], 4],
  ['Harmonic Major', [0, 2, 4, 5, 7, 8, 11], 4],
  ['Dorian b5', [0, 2, 3, 5, 6, 9, 10], 6],
  ['Phrygian b4', [0, 1, 3, 4, 7, 8, 10], 6],
  ['Lydian b3', [0, 2, 3, 6, 7, 9, 11], 6],
  ['Mixolydian b2', [0, 1, 4, 5, 7, 9, 10], 6],
  ['Lydian Augmented #2', [0, 3, 4, 6, 8, 9, 11], 6],
  ['Locrian bb7', [0, 1, 3, 5, 6, 8, 9], 6],
  ['Double Harmonic (Byzantine/Gypsy Major)', [0, 1, 4, 5, 7, 8, 11], 4],
  ['Hungarian Minor (Gypsy Minor)', [0, 2, 3, 6, 7, 8, 11], 4],
  ['Hungarian Major', [0, 3, 4, 6, 7, 9, 10], 5],
  ['Neapolitan Minor', [0, 1, 3, 5, 7, 8, 11], 5],
  ['Neapolitan Major', [0, 1, 3, 5, 7, 9, 11], 5],
  ['Persian', [0, 1, 4, 5, 6, 8, 11], 5],
  ['Oriental', [0, 1, 4, 5, 6, 9, 10], 5],
  ['Enigmatic', [0, 1, 4, 6, 8, 10, 11], 6],
  ['Ultraphrygian', [0, 1, 3, 4, 7, 8, 9], 6],
  ['Diminished (Whole-Half)', [0, 2, 3, 5, 6, 8, 9, 11], 3],
  ['Dominant Diminished (Half-Whole)', [0, 1, 3, 4, 6, 7, 9, 10], 3],
  ['Bebop Dominant', [0, 2, 4, 5, 7, 9, 10, 11], 4],
  ['Bebop Major', [0, 2, 4, 5, 7, 8, 9, 11], 4],
  ['Bebop Melodic Minor', [0, 2, 3, 5, 7, 8, 9, 11], 5],
  ['Bebop Dorian', [0, 2, 3, 4, 5, 7, 9, 10], 5],
  ['Spanish 8-Tone', [0, 1, 3, 4, 5, 6, 8, 10], 5],
  ['Chromatic', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 9],
]

function makeMatch(root, name, intervals, prio, extra) {
  const pcs = intervals.map((i) => (root + i) % 12)
  const pcSet = new Set(pcs)
  return {
    root,
    scaleName: name,
    intervals,
    pcs,
    pcSet,
    priority: prio,
    rootName: noteName(root),
    fullName: `${noteName(root)} ${name}`,
    score: 0,
    coverage: 0,
    ...extra,
  }
}

// --- 1) scales containing a selection --------------------------------------
export function findScales(selectedPcs, maxResults = 60) {
  const sel = new Set([...selectedPcs].map((p) => ((p % 12) + 12) % 12))
  if (sel.size === 0) return []
  const out = []
  for (let root = 0; root < 12; root++) {
    for (const [name, intervals, prio] of SCALE_DEFS) {
      const pcSet = new Set(intervals.map((i) => (root + i) % 12))
      let superset = true
      for (const p of sel) if (!pcSet.has(p)) { superset = false; break }
      if (!superset) continue
      const m = makeMatch(root, name, intervals, prio, {
        extra: pcSet.size - sel.size,
        exact: pcSet.size === sel.size,
      })
      out.push(m)
    }
  }
  out.sort((a, b) =>
    (a.exact === b.exact ? 0 : a.exact ? -1 : 1) ||
    a.extra - b.extra ||
    a.pcs.length - b.pcs.length ||
    a.priority - b.priority ||
    a.root - b.root)
  return out.slice(0, maxResults)
}

export function extraNotes(match, selectedPcs) {
  const sel = new Set([...selectedPcs].map((p) => ((p % 12) + 12) % 12))
  return match.pcs.filter((p) => !sel.has(p)).sort((a, b) => a - b).map(noteName)
}

// --- 2) detect from a pitch-class weight histogram -------------------------
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length

export function detectFromWeights(weights, maxResults = 8) {
  const total = weights.reduce((s, x) => s + x, 0)
  if (total <= 0) return []
  const w = weights.map((x) => x / total)
  const wm = mean(w)
  const wc = w.map((x) => x - wm)
  const wstd = Math.sqrt(wc.reduce((s, x) => s + x * x, 0))

  const results = []
  for (let root = 0; root < 12; root++) {
    for (const [name, intervals, prio] of SCALE_DEFS) {
      const pcSet = new Set(intervals.map((i) => (root + i) % 12))
      const template = Array.from({ length: 12 }, (_, p) => (pcSet.has(p) ? 1 : 0))
      template[root] += 1.6
      const fifth = (root + 7) % 12
      if (pcSet.has(fifth)) template[fifth] += 0.6
      const tm = mean(template)
      const tc = template.map((x) => x - tm)
      const tstd = Math.sqrt(tc.reduce((s, x) => s + x * x, 0))
      let corr = 0
      if (wstd > 0 && tstd > 0) {
        let dot = 0
        for (let i = 0; i < 12; i++) dot += wc[i] * tc[i]
        corr = dot / (wstd * tstd)
      }
      let coverage = 0
      for (const p of pcSet) coverage += w[p]
      results.push(makeMatch(root, name, intervals, prio, { score: corr, coverage, extra: 0, exact: false }))
    }
  }
  results.sort((a, b) =>
    (Math.round(b.score * 1e4) - Math.round(a.score * 1e4)) ||
    (Math.round(b.coverage * 1e4) - Math.round(a.coverage * 1e4)) ||
    a.priority - b.priority)
  return results.slice(0, maxResults)
}

// duration-weighted pitch-class histogram, ignoring the drum channel
export async function pitchClassWeightsFromFile(file) {
  const { Midi } = await import('@tonejs/midi')
  const buffer = await file.arrayBuffer()
  const midi = new Midi(buffer)
  const weights = new Array(12).fill(0)
  let count = 0
  for (const track of midi.tracks) {
    if (track.channel === 9) continue
    for (const note of track.notes) {
      weights[note.midi % 12] += Math.max(1, note.durationTicks)
      count++
    }
  }
  return { weights, count }
}

export async function detectFromFile(file, maxResults = 8) {
  const { weights, count } = await pitchClassWeightsFromFile(file)
  return { matches: detectFromWeights(weights, maxResults), weights, count }
}

// pcs -> MIDI notes within one octave from `base`, plus the octave on top
export function scaleMidiNotes(pcs, base = 48) {
  const notes = [...pcs].map((p) => base + ((((p - base) % 12) + 12) % 12)).sort((a, b) => a - b)
  return notes.length ? [...notes, notes[0] + 12] : []
}
