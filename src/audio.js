/**
 * Tiny synth for previewing notes, via Tone.js. The AudioContext can only start
 * after a user gesture, so the first note lazily boots it. Soft, slightly
 * bell-like triangle tone with a quick attack and exponential-ish decay.
 */
let Tone = null
let synth = null
let started = false

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12)

async function ensure() {
  if (!Tone) Tone = await import('tone')   // ~63kB, only when sound is first used
  if (!started) {
    await Tone.start()
    started = true
  }
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth).toDestination()
    synth.set({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.006, decay: 0.32, sustain: 0.18, release: 0.45 },
      volume: -9,
    })
    synth.maxPolyphony = 16
  }
}

export async function playNote(midi, dur = 0.5) {
  try {
    await ensure()
    synth.triggerAttackRelease(midiToFreq(midi), dur)
  } catch { /* audio unavailable — stay silent */ }
}

export async function playChord(midis, dur = 0.8) {
  if (!midis || midis.length === 0) return
  try {
    await ensure()
    synth.triggerAttackRelease(midis.map(midiToFreq), dur)
  } catch { /* silent */ }
}

export async function playSequence(midis, intervalMs = 150, dur = 0.32) {
  if (!midis || midis.length === 0) return
  try {
    await ensure()
    const now = Tone.now()
    midis.forEach((m, i) => {
      synth.triggerAttackRelease(midiToFreq(m), dur, now + (i * intervalMs) / 1000)
    })
  } catch { /* silent */ }
}
