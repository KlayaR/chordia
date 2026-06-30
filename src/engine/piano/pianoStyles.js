/**
 * Per-style parameters for the piano humanizer (ported from MidiHuman).
 * Velocities are MIDI points; timing is milliseconds.
 */
export const VELOCITY_CEILING = 125

// melodyBoost, innerCut, bassAdjust, accent, dynSwell, contour, velJitter,
// melodyLead, chordSpread, handAsync, timingJitter, rubato,
// pedal, pedalDelayMs, pedalMaxDensity
export const STYLES = {
  Pop: {
    name: 'Pop',
    melodyBoost: 12, innerCut: 10, bassAdjust: 0, accent: 4, dynSwell: 4,
    contour: 0.30, velJitter: 3,
    melodyLead: 8, chordSpread: 5, handAsync: 6, timingJitter: 4, rubato: 0.15,
    pedal: true, pedalDelayMs: 30, pedalMaxDensity: 4.0,
  },
  Cinematic: {
    name: 'Cinematic',
    melodyBoost: 16, innerCut: 14, bassAdjust: 2, accent: 3, dynSwell: 9,
    contour: 0.50, velJitter: 4,
    melodyLead: 28, chordSpread: 14, handAsync: 12, timingJitter: 6, rubato: 0.55,
    pedal: true, pedalDelayMs: 42, pedalMaxDensity: 3.0,
  },
  Metalcore: {
    name: 'Metalcore',
    melodyBoost: 14, innerCut: 12, bassAdjust: 4, accent: 8, dynSwell: 3,
    contour: 0.20, velJitter: 3,
    melodyLead: 4, chordSpread: 4, handAsync: 4, timingJitter: 3, rubato: 0.05,
    pedal: true, pedalDelayMs: 20, pedalMaxDensity: 5.0,
  },
}

export const DEFAULT_STYLE = 'Cinematic'
export const STYLE_NAMES = Object.keys(STYLES)
