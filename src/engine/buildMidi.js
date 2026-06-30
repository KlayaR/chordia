/**
 * Build an output MIDI file from voiced chord events.
 * Single track, single channel, velocity 80 by default.
 */
import { Midi } from '@tonejs/midi'

const DEFAULT_VELOCITY = 0.63  // ~80/127 in @tonejs/midi's 0..1 scale

export function buildOutputMidi(sourceMidi, voicedEvents) {
  // Serialise source to JSON and back — the cleanest way to clone header
  // metadata (ppq, tempos, time-sigs) without fighting read-only properties.
  const srcJson = sourceMidi.toJSON()
  const outJson = {
    header: {
      ppq: srcJson.header.ppq,
      tempos: srcJson.header.tempos ?? [{ bpm: 120, ticks: 0 }],
      timeSignatures: srcJson.header.timeSignatures ?? [],
      keySignatures: [],
      meta: [],
      name: '',
    },
    tracks: [{ notes: [], controlChanges: {}, pitchBends: [], instrument: {}, channel: 0, name: '' }],
  }

  const out = new Midi(JSON.stringify(outJson))
  const track = out.tracks[0]
  const ppq = out.header.ppq

  for (const ev of voicedEvents) {
    if (!ev.voiced || ev.voiced.length === 0) continue
    for (const midi of ev.voiced) {
      track.addNote({
        midi: Math.max(0, Math.min(127, Math.round(midi))),
        ticks: Math.max(0, Math.round(ev.tick)),
        durationTicks: Math.max(1, Math.round(ev.durationTicks ?? ppq / 2)),
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
