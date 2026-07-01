/**
 * Realistic piano via Tone.Sampler + the Salamander Grand Piano samples
 * (multi-sampled every minor third, pitch-shifted between). Lives inside Tone.js
 * so it syncs to Tone.Transport for timeline playback, and drives the Scale
 * Finder's note/chord/scale previews. Samples stream from the Tone.js CDN.
 */
import * as Tone from 'tone'

const BASE = 'https://tonejs.github.io/audio/salamander/'
const SAMPLES = {
  A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
  A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
  A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
  A7: 'A7.mp3', C8: 'C8.mp3',
}

let sampler = null
let loadPromise = null

// Construct the sampler (begins downloading samples). Safe to call without a
// user gesture — it just kicks off the fetch, no AudioContext resume.
function build() {
  if (loadPromise) return loadPromise
  loadPromise = new Promise((resolve) => {
    sampler = new Tone.Sampler({
      urls: SAMPLES, baseUrl: BASE, release: 1.2,
      onload: () => resolve(sampler),
    }).toDestination()
    sampler.volume.value = -6
  })
  return loadPromise
}

// Start the download early (e.g. on page mount) so the first note is instant.
export function preloadPiano() { build() }

export function pianoLoaded() {
  return !!sampler && sampler.loaded
}

// Resume the audio context (needs a user gesture) and wait for samples.
export async function ensurePiano() {
  const p = build()
  await Tone.start()
  await p
  return sampler
}

export const midiToNote = (m) => Tone.Frequency(m, 'midi').toNote()

export async function playNote(midi, dur = 1.4, vel = 0.7) {
  const s = await ensurePiano()
  s.triggerAttackRelease(midiToNote(midi), dur, undefined, vel)
}

export async function playChord(midis, dur = 1.8, vel = 0.7) {
  if (!midis || midis.length === 0) return
  const s = await ensurePiano()
  s.triggerAttackRelease(midis.map(midiToNote), dur, undefined, vel)
}

export async function playSequence(midis, intervalMs = 150, dur = 0.9, vel = 0.7) {
  if (!midis || midis.length === 0) return
  const s = await ensurePiano()
  const now = Tone.now()
  midis.forEach((m, i) => s.triggerAttackRelease(midiToNote(m), dur, now + (i * intervalMs) / 1000, vel))
}

// One-shot chord/notes preview (alias of playChord, kept for callers).
export const previewNotes = playChord

export { Tone }
