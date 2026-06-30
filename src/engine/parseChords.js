/**
 * Parse a MIDI file and group note onsets into chord events.
 * Returns an array of { tick, durationTicks, pitchClasses, notes }
 * where notes = [{ midi, velocity, startTick, durationTicks }]
 */
import { Midi } from '@tonejs/midi'

const DRUM_CHANNEL = 9

export async function parseChordsFromFile(file) {
  const buffer = await file.arrayBuffer()
  const midi = new Midi(buffer)
  const ppq = midi.header.ppq

  // Collect all non-drum note-ons across all tracks
  const raw = []
  for (const track of midi.tracks) {
    for (const note of track.notes) {
      if (note.midi === undefined) continue
      // @tonejs/midi stores channel on the track; skip drum channel
      if (track.channel === DRUM_CHANNEL) continue
      raw.push({
        midi: note.midi,
        velocity: Math.round(note.velocity * 127),
        startTicks: note.ticks,
        durationTicks: note.durationTicks,
      })
    }
  }

  if (raw.length === 0) return { events: [], ppq, midi }

  raw.sort((a, b) => a.startTicks - b.startTicks)

  // Group onsets within ppq*0.08 (≈ 32nd note) into one chord event
  const window = Math.max(1, Math.round(ppq * 0.08))
  const events = []
  let group = [raw[0]]
  let groupTick = raw[0].startTicks

  for (let i = 1; i < raw.length; i++) {
    if (raw[i].startTicks - groupTick <= window) {
      group.push(raw[i])
    } else {
      events.push(_makeEvent(group, groupTick))
      group = [raw[i]]
      groupTick = raw[i].startTicks
    }
  }
  events.push(_makeEvent(group, groupTick))

  return { events, ppq, midi }
}

function _makeEvent(notes, tick) {
  const pcs = [...new Set(notes.map(n => n.midi % 12))].sort((a, b) => a - b)
  const dur = Math.max(...notes.map(n => n.durationTicks))
  return { tick, durationTicks: dur, pitchClasses: pcs, notes }
}
