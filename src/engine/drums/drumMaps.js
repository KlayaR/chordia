/**
 * Drum library maps (ported from MidiHuman). Each map maps MIDI note -> named
 * voice + the limb that plays it. A classifier derives a coarse VoiceType so the
 * rules engine can reason generically. Note convention: C3 = MIDI 60.
 */

export const Limb = {
  LEFT_HAND: 'LEFT_HAND', RIGHT_HAND: 'RIGHT_HAND',
  LEFT_FOOT: 'LEFT_FOOT', RIGHT_FOOT: 'RIGHT_FOOT',
}

export const VoiceType = {
  KICK: 'kick', SNARE: 'snare', SIDESTICK: 'sidestick', HIHAT: 'hihat',
  TOM: 'tom', CRASH: 'crash', RIDE: 'ride', CYMBAL: 'cymbal', UNKNOWN: 'unknown',
}

export const TYPE_COLORS = {
  kick: '#ff9a3c', snare: '#e74c3c', sidestick: '#e74c3c', hihat: '#1abc9c',
  tom: '#3498db', crash: '#9b59b6', ride: '#9b59b6', cymbal: '#9b59b6', unknown: '#95a5a6',
}

export function classify(name) {
  const n = name.toLowerCase()
  if (n.includes('kick')) return VoiceType.KICK
  if (n.includes('sidestick') || n.includes('side stick')) return VoiceType.SIDESTICK
  if (n.includes('snare') || n.includes('rimshot') || n.includes('cross')) return VoiceType.SNARE
  if (n.includes('hh') || n.includes('hi-hat') || n.includes('hihat') || n.includes('hi hat') || n.includes('hat')) return VoiceType.HIHAT
  if (n.includes('tom')) return VoiceType.TOM
  if (n.includes('ride')) return VoiceType.RIDE          // before crash ("Ride Crash")
  if (n.includes('china') || n.includes('splash')) return VoiceType.CYMBAL
  if (n.includes('crash')) return VoiceType.CRASH
  if (n.includes('cymbal')) return VoiceType.CYMBAL
  return VoiceType.UNKNOWN
}

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const LETTER_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export const noteName = (note) => `${LETTERS[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 2}`

export function parseNoteName(text) {
  const m = /^\s*([A-Ga-g])([#b]?)\s*(-?\d+)\s*$/.exec(text)
  if (!m) return null
  let semi = LETTER_SEMI[m[1].toUpperCase()]
  if (m[2] === '#') semi += 1
  else if (m[2] === 'b') semi -= 1
  const note = (parseInt(m[3], 10) + 2) * 12 + semi
  return note >= 0 && note <= 127 ? note : null
}

export function makeVoice(note, name, limb) {
  const vtype = classify(name)
  const n = name.toLowerCase()
  const isHihat = vtype === VoiceType.HIHAT
  return {
    note, name, limb, vtype,
    isKick: vtype === VoiceType.KICK,
    isSnare: vtype === VoiceType.SNARE || vtype === VoiceType.SIDESTICK,
    isTom: vtype === VoiceType.TOM,
    isHihat,
    isCymbal: vtype === VoiceType.CRASH || vtype === VoiceType.RIDE || vtype === VoiceType.CYMBAL,
    isCrash: vtype === VoiceType.CRASH,
    isHhOpen: isHihat && n.includes('open') && !n.includes('half'),
    isHhClosed: isHihat && n.includes('closed'),
    isHhPedal: isHihat && n.includes('pedal'),
  }
}

export function makeMap(name, rows) {
  const voices = new Map()
  for (const [note, vn, limb] of rows) voices.set(note, makeVoice(note, vn, limb))
  return {
    name,
    voices,
    voice: (note) => voices.get(note) || null,
    nameFor: (note) => (voices.get(note)?.name ?? `Note ${note}`),
    hasLeftFootKick: () => [...voices.values()].some((v) => v.isKick && v.limb === Limb.LEFT_FOOT),
    crashCount: () => [...voices.values()].filter((v) => v.isCrash).length,
    orderedVoices: () => {
      const order = { kick: 0, snare: 1, sidestick: 1, tom: 2, hihat: 3, ride: 4, crash: 5, cymbal: 5, unknown: 6 }
      return [...voices.values()].sort((a, b) => (order[a.vtype] ?? 6) - (order[b.vtype] ?? 6) || a.note - b.note)
    },
  }
}

const LH = Limb.LEFT_HAND, RH = Limb.RIGHT_HAND, LF = Limb.LEFT_FOOT, RF = Limb.RIGHT_FOOT

const GGD_MM2 = [
  [36, 'Kick Hit', RF],
  [37, 'Snare Cross Stick', LH], [38, 'Snare Hit', LH], [39, 'Snare Wires Off', LH],
  [42, 'Rack Tom 1 Hit', RH], [43, 'Rack Tom 2 Hit', RH], [44, 'Rack Tom 2 Hit', RH],
  [45, 'Floor Tom 1 Hit', LH], [46, 'Floor Tom 1 Hit', LH], [47, 'Floor Tom 2 Hit', LH], [48, 'Floor Tom 2 Hit', LH],
  [49, 'Hats Tight Tip', RH], [50, 'Hats Tight Edge', RH], [51, 'Hats Closed Tip', RH], [52, 'Hats Closed Edge', RH],
  [53, 'Hats Open 1', RH], [54, 'Hats Open 2', RH], [55, 'Hats Open 3', RH],
  [56, 'Hats Pedal Chick', LF], [57, 'Hats Pedal Ching', LF],
  [58, 'Crash Far Left Crash', LH], [59, 'Crash Far Left Choke', LH], [60, 'Crash Left Crash', LH], [61, 'Crash Left Choke', LH],
  [64, 'Crash Right Crash', RH], [65, 'Crash Right Choke', RH],
  [68, 'Ride Bow', RH], [69, 'Ride Bell', RH], [70, 'Ride Crash', RH], [71, 'Ride Choke', RH],
  [74, 'China Crash', LH], [75, 'China Choke', LH], [76, 'Splash Crash', RH], [77, 'Splash Choke', RH],
]

const GENERAL_MIDI = [
  [36, 'Kick', RF], [35, 'Kick 2', LF],
  [38, 'Snare center', LH], [40, 'Snare rimshot', LH], [37, 'Sidestick', LH],
  [42, 'HH closed', RH], [44, 'HH pedal', LF], [46, 'HH open', RH],
  [49, 'Crash 1', RH], [57, 'Crash 2', LH],
  [51, 'Ride bow', RH], [53, 'Ride bell', RH], [59, 'Ride edge', RH], [55, 'Splash', RH], [52, 'China', LH],
  [41, 'Tom 1', RH], [43, 'Tom 2', RH], [45, 'Tom 3', LH], [47, 'Tom 4', LH], [50, 'Tom 5', RH], [48, 'Tom 6', LH],
]

const SUPERIOR_3 = [
  [36, 'Kick', RF], [65, 'Kick 2 / double kick', LF],
  [38, 'Snare center', LH], [40, 'Snare rimshot', LH], [37, 'Sidestick', LH], [39, 'Snare cross', LH],
  [42, 'HH closed tip', RH], [22, 'HH closed bow', RH], [44, 'HH pedal', LF], [46, 'HH open', RH], [26, 'HH half-open', RH],
  [49, 'Crash 1 bow', RH], [55, 'Crash 1 edge', RH], [57, 'Crash 2 bow', LH], [52, 'China', LH],
  [51, 'Ride bow', RH], [53, 'Ride bell', RH], [59, 'Ride edge', RH],
  [50, 'Tom 1', RH], [48, 'Tom 2', RH], [45, 'Tom 3', LH], [43, 'Tom 4', LH], [41, 'Tom 5 floor', LH],
]

const EZDRUMMER_3 = [
  [36, 'Kick', RF],
  [38, 'Snare center', LH], [40, 'Snare rimshot', LH], [37, 'Sidestick', LH],
  [42, 'HH closed', RH], [44, 'HH pedal', LF], [46, 'HH open', RH], [54, 'HH half-open', RH],
  [49, 'Crash 1', RH], [55, 'Crash 2', LH], [51, 'Ride bow', RH], [53, 'Ride bell', RH], [52, 'China', LH],
  [50, 'Tom 1', RH], [48, 'Tom 2', RH], [45, 'Tom 3', LH], [43, 'Tom 4 floor', LH],
]

const ADDICTIVE_2 = [
  [36, 'Kick', RF],
  [38, 'Snare head', LH], [40, 'Snare rimshot', LH], [37, 'Sidestick', LH],
  [42, 'HH closed', RH], [44, 'HH pedal', LF], [46, 'HH open', RH], [48, 'HH half-open', RH],
  [49, 'Crash 1', RH], [55, 'Crash 2', LH], [51, 'Ride bow', RH], [53, 'Ride bell', RH], [52, 'China', LH],
  [50, 'Tom 1', RH], [47, 'Tom 2', RH], [43, 'Tom 3', LH], [41, 'Tom 4 floor', LH],
]

const SSD5 = [
  [36, 'Kick', RF],
  [38, 'Snare', LH], [40, 'Snare rimshot', LH], [37, 'Sidestick', LH],
  [42, 'HH closed', RH], [44, 'HH pedal', LF], [46, 'HH open', RH],
  [49, 'Crash 1', RH], [55, 'Crash 2', LH], [51, 'Ride', RH], [52, 'China', LH],
  [50, 'Tom 1', RH], [47, 'Tom 2', RH], [43, 'Tom 3', LH], [41, 'Tom 4 floor', LH],
]

const GETGOOD = [
  [36, 'Kick', RF],
  [38, 'Snare center', LH], [40, 'Snare rimshot', LH], [37, 'Sidestick', LH],
  [42, 'HH closed', RH], [44, 'HH pedal', LF], [46, 'HH open', RH],
  [49, 'Crash 1', RH], [55, 'Crash 2', LH], [51, 'Ride bow', RH], [53, 'Ride bell', RH], [52, 'China', LH],
  [50, 'Tom 1', RH], [48, 'Tom 2', RH], [45, 'Tom 3', LH], [43, 'Tom 4 floor', LH],
]

export const DRUM_MAPS = {
  'GGD Modern & Massive 2': makeMap('GGD Modern & Massive 2', GGD_MM2),
  'General MIDI': makeMap('General MIDI', GENERAL_MIDI),
  'Superior Drummer 3': makeMap('Superior Drummer 3', SUPERIOR_3),
  'EZdrummer 3': makeMap('EZdrummer 3', EZDRUMMER_3),
  'Addictive Drums 2': makeMap('Addictive Drums 2', ADDICTIVE_2),
  'Steven Slate Drums 5': makeMap('Steven Slate Drums 5', SSD5),
  'GetGood Drums (Modern & Massive)': makeMap('GetGood Drums (Modern & Massive)', GETGOOD),
}

export const DEFAULT_MAP = 'GGD Modern & Massive 2'
export const DRUM_MAP_NAMES = Object.keys(DRUM_MAPS)
