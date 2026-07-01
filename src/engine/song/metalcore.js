/**
 * Genre engine: modern metalcore / post-hardcore (Dayseeker · Bad Omens · BMTH).
 *
 * Generates a FULL song: a sequence of sections, each with its own progression
 * (roman numerals in a minor key), harmonic rhythm (chords are NOT one-per-bar),
 * and chord colour (lush extensions in clean sections, power chords in heavy
 * ones). Chords are then voice-led (see voiceLead.js) so the right hand barely
 * moves between changes.
 */
import { makeRng } from '../drums/rng.js'

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const noteName = (pc) => NOTE_NAMES[((pc % 12) + 12) % 12]

// roman (relative to the minor tonic) -> [semitone offset, base quality]
const ROMAN = {
  i: [0, 'min'], bII: [1, 'maj'], 'ii°': [2, 'dim'], bIII: [3, 'maj'],
  iv: [5, 'min'], IV: [5, 'maj'], v: [7, 'min'], V: [7, 'maj'],
  bVI: [8, 'maj'], bVII: [10, 'maj'], 'vii°': [11, 'dim'],
}

const QUAL = {
  min: [0, 3, 7], maj: [0, 4, 7], dim: [0, 3, 6], power: [0, 7],
  min7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  minadd9: [0, 3, 7, 14], majadd9: [0, 4, 7, 14],
  sus2: [0, 2, 7], sus4: [0, 5, 7],
}
const SUFFIX = {
  min: 'm', maj: '', dim: 'dim', power: '5', min7: 'm7', maj7: 'maj7',
  minadd9: 'm(add9)', majadd9: 'add9', sus2: 'sus2', sus4: 'sus4',
}

// section defaults: energy, beatsPerChord (harmonic rhythm), colour, comping feel
export const SECTIONS = {
  intro:     { energy: 0.3, beatsPerChord: 8, color: 'lush',  comping: 'arp' },
  verse:     { energy: 0.4, beatsPerChord: 8, color: 'lush',  comping: 'arp' },
  prechorus: { energy: 0.6, beatsPerChord: 4, color: 'triad', comping: 'push' },
  chorus:    { energy: 0.9, beatsPerChord: 4, color: 'power', comping: 'stabs' },
  bridge:    { energy: 0.5, beatsPerChord: 8, color: 'lush',  comping: 'pad' },
  breakdown: { energy: 1.0, beatsPerChord: 16, color: 'power', comping: 'chug' },
  outro:     { energy: 0.3, beatsPerChord: 8, color: 'lush',  comping: 'arp' },
}

// [sectionType, bars]
// Verse 1 skips the pre-chorus (§1.2) — the pre-chorus "lift" is saved for V2,
// once the listener already knows the chorus, so its promise pays off.
export const STRUCTURES = {
  'Anthemic (BMTH / Bad Omens)': [
    ['intro', 8], ['verse', 8], ['chorus', 8],
    ['verse', 8], ['prechorus', 4], ['chorus', 8],
    ['bridge', 8], ['breakdown', 4], ['chorus', 8], ['outro', 8],
  ],
  'Atmospheric (Dayseeker)': [
    ['intro', 8], ['verse', 16], ['chorus', 8],
    ['verse', 8], ['prechorus', 4], ['chorus', 8],
    ['bridge', 8], ['chorus', 16], ['outro', 8],
  ],
  'Heavy (breakdown-driven)': [
    ['intro', 4], ['verse', 8], ['chorus', 8],
    ['verse', 8], ['prechorus', 4], ['chorus', 8],
    ['breakdown', 8], ['bridge', 4], ['chorus', 8], ['outro', 4],
  ],
}
export const STRUCTURE_NAMES = Object.keys(STRUCTURES)

// progression pools per section type (roman-numeral tokens, natural minor).
// Verses stay static (2-3 chords); the chorus opens up. Canonical progressions
// from the genre rulebook are first in each list.
const POOLS = {
  intro:     [['i'], ['i', 'bVI']],
  verse:     [['i', 'bVI'], ['i', 'bVII', 'bVI'], ['i'], ['i', 'v', 'bVI', 'bVII']],
  prechorus: [['bVI', 'bVII', 'i'], ['iv', 'bVII'], ['bVI', 'bVII'], ['iv', 'v', 'bVI', 'bVII']],
  chorus:    [['i', 'bVI', 'bIII', 'bVII'], ['i', 'bVII', 'bVI', 'bVII'], ['bVI', 'bVII', 'i', 'i'], ['i', 'bVI', 'bVII']],
  bridge:    [['iv', 'bVI', 'bVII'], ['bVI', 'bIII', 'bVII', 'iv'], ['i', 'bVI']],
  breakdown: [['i'], ['i', 'bVII'], ['i', 'iv']],
  outro:     [['i', 'bVI'], ['i']],
}

// harmonic-rhythm cells (beat durations per chord slot). Verses/pre are broken &
// asymmetric; the CHORUS flattens to even — that contrast is the "release" (§3.4).
const RHYTHM = {
  intro:     [[8], [4, 4]],
  verse:     [[3, 5], [5, 3], [3, 3, 2], [6, 2]],
  prechorus: [[3, 3, 2], [2, 2, 2, 2]],
  chorus:    [[4], [4, 4]],
  bridge:    [[8], [4, 4]],
  breakdown: [[16]],
  outro:     [[8], [4, 4]],
}

function applyColor(base, color) {
  if (color === 'power') return base === 'dim' ? 'dim' : 'power'
  if (color === 'triad') return base
  if (base === 'min') return 'minadd9'   // lush
  if (base === 'maj') return 'majadd9'
  return base
}

export function resolveRoman(token, keyRoot, color) {
  const entry = ROMAN[token] || ROMAN.i
  const [offset, base] = entry
  const quality = applyColor(base, color)
  const root = (keyRoot + offset) % 12
  return {
    roman: token, root, quality,
    intervals: QUAL[quality] || QUAL.min,
    name: `${noteName(root)}${SUFFIX[quality] ?? ''}`,
  }
}

const pick = (rng, arr) => arr[Math.floor(rng.uniform(0, arr.length))]

/**
 * Build a full song. Returns { sections, events, keyRoot, scaleName, structure }.
 * Each event: { section, roman, chord, startBeat, durBeats, bar }.
 * (Voice leading + note assignment happens in voiceLead.js.)
 */
export function generateSong({ keyRoot = 4, scaleName = 'Natural Minor', structureName = 'Anthemic (BMTH / Bad Omens)', seed } = {}) {
  const rng = makeRng(seed)
  const structure = STRUCTURES[structureName] || STRUCTURES[STRUCTURE_NAMES[0]]
  const sections = []
  const events = []
  let beatCursor = 0

  // The chorus is the hook and the verse is a recurring theme — pick each ONCE
  // and reuse it every occurrence, so the song has identity. Other section types
  // (intro/bridge/breakdown/outro) are picked fresh.
  // pick the progression AND the harmonic-rhythm cell once per recurring section
  // type, so the hook + its groove stay consistent across the song
  const themedProg = {}, themedCell = {}
  const themedTypes = new Set(['chorus', 'verse', 'prechorus'])
  const progFor = (type) => {
    if (themedTypes.has(type)) return (themedProg[type] ||= pick(rng, POOLS[type] || POOLS.verse))
    return pick(rng, POOLS[type] || POOLS.verse)
  }
  const cellFor = (type) => {
    if (themedTypes.has(type)) return (themedCell[type] ||= pick(rng, RHYTHM[type] || RHYTHM.verse))
    return pick(rng, RHYTHM[type] || RHYTHM.chorus)
  }

  // per-song: pedal-point verses/intros (tonic drone) or moving bass
  const usePedal = rng.uniform(0, 1) < 0.5

  for (const [type, bars] of structure) {
    const def = SECTIONS[type]
    const prog = progFor(type)
    const cell = cellFor(type)
    const pedal = usePedal && (type === 'verse' || type === 'intro')
    const totalBeats = bars * 4
    const sectionEvents = []
    let filled = 0, ci = 0, pi = 0
    while (filled < totalBeats) {
      const dur = Math.min(cell[ci % cell.length], totalBeats - filled)
      const token = prog[pi % prog.length]
      const chord = resolveRoman(token, keyRoot, def.color)
      const ev = {
        section: type, roman: token, chord, pedal,
        bassPc: pedal ? keyRoot : chord.root,
        startBeat: beatCursor + filled, durBeats: dur,
        bar: Math.floor((beatCursor + filled) / 4) + 1,
      }
      sectionEvents.push(ev)
      events.push(ev)
      filled += dur
      ci += 1; pi += 1
    }
    sections.push({ type, bars, comping: def.comping, color: def.color, energy: def.energy,
      pedal, cell, startBeat: beatCursor, events: sectionEvents, progression: prog })
    beatCursor += totalBeats
  }

  return { sections, events, keyRoot, scaleName, structureName, totalBeats: beatCursor, totalBars: beatCursor / 4 }
}
