import { Midi } from '@tonejs/midi'

const DEFAULT_VELOCITY = 0.63  // ~80/127

export function buildOutputMidi(sourceMidi, voicedEvents) {
  // Round-trip through binary to clone the header (PPQ, tempos, time-sigs)
  // without touching any read-only properties
  const out = new Midi(sourceMidi.toArray())

  // Discard all original tracks, keep only the voiced result
  out.tracks.length = 0
  const track = out.addTrack()

  for (const ev of voicedEvents) {
    if (!ev.voiced || ev.voiced.length === 0) continue
    for (const midi of ev.voiced) {
      track.addNote({
        midi: Math.max(0, Math.min(127, Math.round(midi))),
        ticks: Math.max(0, Math.round(ev.tick)),
        durationTicks: Math.max(1, Math.round(ev.durationTicks ?? out.header.ppq / 2)),
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
