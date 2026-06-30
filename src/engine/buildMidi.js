/**
 * Build an output MIDI file from voiced chord events.
 * Single track, single channel, velocity 80 by default.
 */
import { Midi } from '@tonejs/midi'

const DEFAULT_VELOCITY = 0.63  // ~80/127 in @tonejs/midi's 0..1 scale

export function buildOutputMidi(sourceMidi, voicedEvents) {
  const out = new Midi()

  // copy PPQ so tick values from the source are correctly interpreted
  out.header.ppq = sourceMidi.header.ppq

  // copy tempo map
  const tempos = sourceMidi.header.tempos
  if (tempos && tempos.length > 0) {
    tempos.forEach(t => out.header.tempos.push({ ...t }))
  } else {
    out.header.tempos.push({ bpm: 120, ticks: 0, time: 0 })
  }

  // copy time signatures
  const ts = sourceMidi.header.timeSignatures
  if (ts && ts.length > 0) {
    ts.forEach(t => out.header.timeSignatures.push({ ...t }))
  }

  const track = out.addTrack()

  for (const ev of voicedEvents) {
    for (const midi of ev.voiced) {
      track.addNote({
        midi,
        ticks: ev.tick,
        durationTicks: ev.durationTicks,
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
