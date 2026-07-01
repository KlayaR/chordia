/**
 * Realistic piano via Tone.Sampler + the Salamander Grand Piano samples
 * (multi-sampled every minor third, pitch-shifted between). Far better than the
 * Scale Finder's synth, and it lives inside Tone.js so it syncs to Tone.Transport
 * for timeline playback. Samples stream from the Tone.js CDN on first use.
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

export function pianoLoaded() {
  return !!sampler && sampler.loaded
}

export async function ensurePiano() {
  await Tone.start()
  if (sampler && sampler.loaded) return sampler
  if (!loadPromise) {
    loadPromise = new Promise((resolve) => {
      sampler = new Tone.Sampler({
        urls: SAMPLES,
        baseUrl: BASE,
        release: 1.2,
        onload: () => resolve(sampler),
      }).toDestination()
      sampler.volume.value = -6
    })
  }
  return loadPromise
}

export const midiToNote = (m) => Tone.Frequency(m, 'midi').toNote()

// One-shot chord/notes preview (not transport-scheduled).
export async function previewNotes(midis, dur = 1.4, vel = 0.7) {
  const s = await ensurePiano()
  s.triggerAttackRelease(midis.map(midiToNote), dur, undefined, vel)
}

export { Tone }
