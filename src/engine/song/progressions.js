/**
 * Library of popular chord progressions, expressed as scale degrees (1..7) so
 * they resolve against whatever key + scale is selected. `scaleHint` says which
 * scale the progression is written for (major- vs minor-oriented) — the palette
 * can surface the ones that fit the current scale first.
 */

export const PROGRESSIONS = [
  // --- major / pop -------------------------------------------------------
  { name: 'Axis (I–V–vi–IV)', category: 'Pop', scaleHint: 'major', degrees: [1, 5, 6, 4] },
  { name: 'Sensitive (vi–IV–I–V)', category: 'Pop', scaleHint: 'major', degrees: [6, 4, 1, 5] },
  { name: 'Doo-wop (I–vi–IV–V)', category: 'Pop', scaleHint: 'major', degrees: [1, 6, 4, 5] },
  { name: 'Classic (I–IV–V)', category: 'Pop', scaleHint: 'major', degrees: [1, 4, 5] },
  { name: 'Pop-punk (I–IV–vi–V)', category: 'Pop', scaleHint: 'major', degrees: [1, 4, 6, 5] },
  { name: 'Jazz cadence (ii–V–I)', category: 'Jazz', scaleHint: 'major', degrees: [2, 5, 1] },
  { name: 'Canon (I–V–vi–iii–IV)', category: 'Classical', scaleHint: 'major', degrees: [1, 5, 6, 3, 4] },
  // --- minor / heavy -----------------------------------------------------
  { name: 'Metalcore (i–VI–VII)', category: 'Metalcore', scaleHint: 'minor', degrees: [1, 6, 7] },
  { name: 'Epic (i–VII–VI–VII)', category: 'Metalcore', scaleHint: 'minor', degrees: [1, 7, 6, 7] },
  { name: 'Minor climb (i–VI–III–VII)', category: 'Cinematic', scaleHint: 'minor', degrees: [1, 6, 3, 7] },
  { name: 'Andalusian (i–VII–VI–V)', category: 'Cinematic', scaleHint: 'minor', degrees: [1, 7, 6, 5] },
  { name: 'Minor classic (i–iv–v)', category: 'Rock', scaleHint: 'minor', degrees: [1, 4, 5] },
  { name: 'Ballad (i–iv–VII–III)', category: 'Cinematic', scaleHint: 'minor', degrees: [1, 4, 7, 3] },
  { name: 'Dark loop (i–VI–iv–VII)', category: 'Metalcore', scaleHint: 'minor', degrees: [1, 6, 4, 7] },
]

export const CATEGORIES = [...new Set(PROGRESSIONS.map((p) => p.category))]

/** Resolve a progression's degrees against a key's diatonic chords. */
export function resolveProgression(prog, diatonic) {
  return prog.degrees.map((d) => diatonic[(d - 1) % diatonic.length])
}
