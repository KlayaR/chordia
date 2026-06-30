/**
 * Build an output MIDI file from voiced chord events.
 * Single track, single channel, velocity 80 by default.
 */
import { Midi } from '@tonejs/midi'

const DEFAULT_VELOCITY = 0.63  // ~80/127 in @tonejs/midi's 0..1 scale

export function buildOutputMidi(sourceMidi, voicedEvents) {
  const out = new Midi()
  out.header.setTempo(sourceMidi.header.tempos[0]?.bpm ?? 120)
  out.header.timeSignatures = sourceMidi.header.timeSignatures

  const track = out.addTrack()

  for (const ev of voicedEvents) {
    const dur = ev.durationTicks
    const startTicks = ev.tick

    for (const midi of ev.voiced) {
      track.addNote({
        midi,
        ticks: startTicks,
        durationTicks: dur,
        velocity: DEFAULT_VELOCITY,
      })
    }
  }

  return out
}

export function midiToBlob(midi) {
  const bytes = midi.toArray()
  return new Blob([bytes], { type: 'audio/midi' })
}

export function downloadMidi(midi, filename = 'chordia_voiced.mid') {
  const blob = midiToBlob(midi)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
