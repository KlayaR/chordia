/**
 * Parse a pitched (piano) MIDI and analyse its structure (ported from MidiHuman).
 * Groups onsets into chord events, tags each note melody/inner/bass (skyline),
 * splits hands at the largest pitch gap, marks phrase ends from melody rests.
 */
import { TempoMap, TimeSigMap, MidiParseError } from '../drums/drumParser.js'

const DRUM_CHANNEL = 9

export function makePianoNote(o) {
  return {
    note: o.note, velocity: o.velocity, start: o.start, dur: o.dur, channel: o.channel ?? 0,
    eventId: -1, role: 'inner', hand: 'RH',
    timeMs: 0, bar: 1, beat: 1, phraseEnd: false,
    origVelocity: o.velocity, origStart: o.start, index: o.index ?? 0,
  }
}

function pitchedTrack(midi) {
  let best = null, bestN = 0
  midi.tracks.forEach((t, i) => {
    if (t.channel === DRUM_CHANNEL) return
    if (t.notes.length > bestN) { best = i; bestN = t.notes.length }
  })
  return best
}

export function analyze(notes, ppq) {
  if (!notes.length) return []
  notes.sort((a, b) => a.start - b.start || a.note - b.note)
  const window = Math.max(1, Math.trunc(ppq * 0.08))

  const events = []
  let cur = []
  let curTick = notes[0].start
  for (const n of notes) {
    if (cur.length && n.start - curTick > window) {
      events.push({ tick: curTick, notes: [...cur].sort((a, b) => a.note - b.note) })
      cur = []
    }
    if (!cur.length) curTick = n.start
    cur.push(n)
  }
  if (cur.length) events.push({ tick: curTick, notes: [...cur].sort((a, b) => a.note - b.note) })

  events.forEach((ev, evId) => {
    const en = ev.notes
    let split = 60
    if (en.length >= 2) {
      let biggest = -1, gi = 0
      for (let i = 0; i < en.length - 1; i++) {
        const gap = en[i + 1].note - en[i].note
        if (gap >= biggest) { biggest = gap; gi = i }   // ties → higher index (matches Python max)
      }
      if (biggest >= 5) split = en[gi].note + biggest / 2
    }
    const top = en[en.length - 1].note
    const bottom = en[0].note
    for (const n of en) {
      n.eventId = evId
      n.hand = n.note < split ? 'LH' : 'RH'
      if (n.note === top) n.role = 'melody'
      else if (n.note === bottom && en.length >= 2) n.role = 'bass'
      else n.role = 'inner'
    }
  })

  const melody = events.map((ev) => ev.notes[ev.notes.length - 1])
  for (let i = 0; i < melody.length - 1; i++) {
    if (melody[i + 1].start - melody[i].start > ppq * 1.25) melody[i].phraseEnd = true
  }
  if (melody.length) melody[melody.length - 1].phraseEnd = true
  return events
}

export async function parsePiano(file, trackIndex = null) {
  const { Midi } = await import('@tonejs/midi')
  let midi
  try {
    midi = new Midi(await file.arrayBuffer())
  } catch (e) {
    throw new MidiParseError(`Could not read MIDI file: ${e.message}`)
  }
  const ppq = midi.header.ppq || 480
  const tempoMap = new TempoMap(ppq, (midi.header.tempos || []).map((t) => [t.ticks, Math.round(60000000 / t.bpm)]))
  const tsMap = new TimeSigMap(ppq, (midi.header.timeSignatures || []).map((t) => [t.ticks, t.timeSignature[0], t.timeSignature[1]]))

  if (trackIndex === null) trackIndex = pitchedTrack(midi)
  if (trackIndex === null) throw new MidiParseError('NO_PITCHED_NOTES')

  const track = midi.tracks[trackIndex]
  const channel = track.channel ?? 0
  const notes = track.notes.map((nt, i) => makePianoNote({
    note: nt.midi, velocity: Math.max(1, Math.round(nt.velocity * 127)),
    start: nt.ticks, dur: Math.max(1, nt.durationTicks), channel, index: i,
  }))

  for (const n of notes) {
    n.timeMs = tempoMap.tickToMs(n.start)
    const [bar, beat] = tsMap.barBeat(n.start)
    n.bar = bar; n.beat = beat
  }

  const events = analyze(notes, ppq)
  return { midi, trackIndex, notes, events, tempoMap, tsMap, ppq, channel, filename: file.name }
}
