/**
 * Detect chord name from a set of pitch classes.
 * Returns { root, rootPc, quality, name, symbol, intervals, score }
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

// [quality, intervals, symbol_suffix, priority]
// priority: lower = simpler / preferred when tied
const CHORD_TYPES = [
  ['power',     [0, 7],           '5',    10],
  ['major',     [0, 4, 7],        '',     1],
  ['minor',     [0, 3, 7],        'm',    1],
  ['dim',       [0, 3, 6],        'dim',  2],
  ['aug',       [0, 4, 8],        'aug',  2],
  ['sus2',      [0, 2, 7],        'sus2', 3],
  ['sus4',      [0, 5, 7],        'sus4', 3],
  ['dom7',      [0, 4, 7, 10],    '7',    2],
  ['maj7',      [0, 4, 7, 11],    'maj7', 2],
  ['min7',      [0, 3, 7, 10],    'm7',   2],
  ['minmaj7',   [0, 3, 7, 11],    'mM7',  3],
  ['dim7',      [0, 3, 6, 9],     'dim7', 3],
  ['hdim7',     [0, 3, 6, 10],    'm7b5', 3],
  ['aug7',      [0, 4, 8, 10],    'aug7', 3],
  ['add9',      [0, 2, 4, 7],     'add9', 4],
  ['madd9',     [0, 2, 3, 7],     'madd9',4],
  ['dom9',      [0, 2, 4, 7, 10], '9',    4],
  ['maj9',      [0, 2, 4, 7, 11], 'maj9', 4],
  ['min9',      [0, 2, 3, 7, 10], 'm9',   4],
  ['maj6',      [0, 4, 7, 9],     '6',    4],
  ['min6',      [0, 3, 7, 9],     'm6',   4],
]

export function detectChord(pitchClasses) {
  if (!pitchClasses || pitchClasses.length === 0) return null
  const pcs = new Set(pitchClasses)
  let best = null
  let bestScore = -Infinity

  for (let root = 0; root < 12; root++) {
    for (const [quality, intervals, suffix, priority] of CHORD_TYPES) {
      const transposed = intervals.map(i => (root + i) % 12)
      const matched = transposed.filter(pc => pcs.has(pc)).length
      const total = transposed.length
      if (matched < Math.ceil(total * 0.6)) continue // need at least 60% match

      // score: matched notes vs total, penalise complexity
      const score = (matched / total) * 100 - priority * 2 + (matched === total ? 10 : 0)
      if (score > bestScore) {
        bestScore = score
        best = { root, rootPc: root, quality, intervals, suffix, score }
      }
    }
  }

  if (!best) return { root: pitchClasses[0], rootPc: pitchClasses[0], quality: 'unknown',
                      name: '?', symbol: '?', intervals: [], score: 0 }

  const rootName = NOTE_NAMES[best.root]
  return {
    ...best,
    name: `${rootName}${best.suffix}`,
    symbol: `${rootName}${best.suffix}`,
  }
}

export function detectChordsForEvents(events) {
  return events.map(ev => ({
    ...ev,
    chord: detectChord(ev.pitchClasses),
  }))
}
