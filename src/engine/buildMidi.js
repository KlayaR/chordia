import { Midi } from '@tonejs/midi'

const DEFAULT_VELOCITY = 0.63  // ~80/127

export function buildOutputMidi(sourceMidi, voicedEvents) {
  const out = new Midi()
  const srcPpq = sourceMidi.header.ppq || 480

  // TypeScript marks ppq as readonly but the compiled JS property is writable
  out.header.ppq = srcPpq

  // Copy tempo map
  const srcTempos = sourceMidi.header.tempos
  if (srcTempos && srcTempos.length > 0) {
    srcTempos.forEach(t => out.header.tempos.push({ bpm: t.bpm, ticks: t.ticks, time: t.time }))
  } else {
    out.header.tempos.push({ bpm: 120, ticks: 0, time: 0 })
  }

  // Copy time signatures
  const srcTs = sourceMidi.header.timeSignatures
  if (srcTs && srcTs.length > 0) {
    srcTs.forEach(t => out.header.timeSignatures.push({ ...t }))
  }

  const track = out.addTrack()

  for (const ev of voicedEvents) {
    if (!ev.voiced || ev.voiced.length === 0) continue
    for (const midi of ev.voiced) {
      track.addNote({
        midi: Math.max(0, Math.min(127, Math.round(midi))),
        ticks: Math.max(0, Math.round(ev.tick)),
        durationTicks: Math.max(1, Math.round(ev.durationTicks ?? srcPpq / 2)),
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
