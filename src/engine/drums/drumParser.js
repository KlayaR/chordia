/**
 * MIDI reading / writing for the drum humanizer (ported from MidiHuman).
 * Uses @tonejs/midi: parse to DrumNotes with absolute ticks + ms + bar/beat,
 * humanize, then write back preserving every other track and message.
 */

const DRUM_CHANNEL = 9
const DEFAULT_TEMPO = 500000 // us per beat = 120 BPM

export class MidiParseError extends Error {}

// --- tempo / time-signature maps -------------------------------------------
export class TempoMap {
  constructor(ppq, tempoEvents) {
    this.ppq = ppq
    let evs = (tempoEvents || []).slice().sort((a, b) => a[0] - b[0])
    if (!evs.length || evs[0][0] !== 0) evs = [[0, DEFAULT_TEMPO], ...evs]
    this._ticks = []; this._tempos = []; this._msAt = []
    let ms = 0
    let [prevTick, prevTempo] = evs[0]
    this._ticks.push(prevTick); this._tempos.push(prevTempo); this._msAt.push(0)
    for (let i = 1; i < evs.length; i++) {
      const [tick, tempo] = evs[i]
      ms += ((tick - prevTick) / ppq) * (prevTempo / 1000)
      this._ticks.push(tick); this._tempos.push(tempo); this._msAt.push(ms)
      prevTick = tick; prevTempo = tempo
    }
  }
  _search(tick) {
    let lo = 0, hi = this._ticks.length - 1, idx = 0
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (this._ticks[mid] <= tick) { idx = mid; lo = mid + 1 } else hi = mid - 1
    }
    return idx
  }
  tickToMs(tick) {
    const i = this._search(tick)
    return this._msAt[i] + ((tick - this._ticks[i]) / this.ppq) * (this._tempos[i] / 1000)
  }
  tempoAt(tick) { return this._tempos[this._search(tick)] }
  bpmAt(tick) { return 60000000 / this.tempoAt(tick) }
  msDeltaToTicks(msDelta, atTick) { return (msDelta * 1000) / this.tempoAt(atTick) * this.ppq }
}

export class TimeSigMap {
  constructor(ppq, tsEvents) {
    this.ppq = ppq
    let evs = (tsEvents || []).slice().sort((a, b) => a[0] - b[0])
    if (!evs.length || evs[0][0] !== 0) evs = [[0, 4, 4], ...evs]
    this._segments = []
    let barCounter = 1
    for (let i = 0; i < evs.length; i++) {
      const [tick, num, den] = evs[i]
      const barTicks = num * ((ppq * 4) / den)
      this._segments.push([tick, num, den, barTicks, barCounter])
      if (i + 1 < evs.length) {
        const span = evs[i + 1][0] - tick
        barCounter += barTicks ? Math.max(0, Math.floor(span / barTicks)) : 0
      }
    }
  }
  _segmentFor(tick) {
    let chosen = this._segments[0]
    for (const seg of this._segments) { if (seg[0] <= tick) chosen = seg; else break }
    return chosen
  }
  barBeat(tick) {
    const [startTick, , den, barTicks, startBar] = this._segmentFor(tick)
    const offset = tick - startTick
    const barInSeg = barTicks ? Math.floor(offset / barTicks) : 0
    const tickInBar = offset - barInSeg * barTicks
    const beatTicks = (this.ppq * 4) / den
    const beat = 1 + (beatTicks ? tickInBar / beatTicks : 0)
    return [startBar + barInSeg, beat]
  }
}

// --- normalised note --------------------------------------------------------
export function makeDrumNote(o) {
  return {
    note: o.note, velocity: o.velocity, tick: o.tick, duration: o.duration,
    channel: o.channel ?? DRUM_CHANNEL,
    timeMs: 0, bar: 1, beat: 1, voice: o.voice ?? null,
    origVelocity: o.velocity, origTick: o.tick, origTimeMs: 0,
    role: '', targetVel: null, targetSpread: null,
    isGhost: false, isRuff: false, isFill: false, isFillFinal: false,
    lockedTiming: false, removed: false, index: o.index ?? 0,
  }
}

function findDrumTrack(midi) {
  let best = null, bestN = 0
  midi.tracks.forEach((t, i) => {
    if (t.channel === DRUM_CHANNEL && t.notes.length > bestN) { best = i; bestN = t.notes.length }
  })
  if (best !== null) return best
  const withNotes = midi.tracks.map((t, i) => [i, t.notes.length]).filter(([, n]) => n > 0)
  if (withNotes.length === 1) return withNotes[0][0]
  if (withNotes.length) return withNotes.sort((a, b) => b[1] - a[1])[0][0]
  return null
}

export async function parseDrums(file, drumMap, trackIndex = null) {
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

  if (trackIndex === null) trackIndex = findDrumTrack(midi)
  if (trackIndex === null) throw new MidiParseError('NO_DRUM_TRACK')

  const track = midi.tracks[trackIndex]
  const channel = track.channel ?? DRUM_CHANNEL
  const unmapped = new Set()
  const notes = track.notes.map((nt, i) => {
    const voice = drumMap.voice(nt.midi)
    if (!voice) unmapped.add(nt.midi)
    return makeDrumNote({
      note: nt.midi, velocity: Math.max(1, Math.round(nt.velocity * 127)),
      tick: nt.ticks, duration: Math.max(1, nt.durationTicks), channel, voice, index: i,
    })
  })

  for (const n of notes) {
    n.timeMs = tempoMap.tickToMs(n.tick)
    n.origTimeMs = n.timeMs
    const [bar, beat] = tsMap.barBeat(n.tick)
    n.bar = bar; n.beat = beat
  }

  const totalTicks = notes.length ? Math.max(...notes.map((n) => n.tick)) : 0
  const totalBars = notes.length ? tsMap.barBeat(totalTicks)[0] : 0

  return { midi, trackIndex, notes, tempoMap, tsMap, ppq, totalBars, channel,
    unmappedNotes: [...unmapped].sort((a, b) => a - b), filename: file.name }
}

export async function buildOutput(parse, notes) {
  const { Midi } = await import('@tonejs/midi')
  const out = new Midi(parse.midi.toArray())          // clone (preserves everything)
  const track = out.tracks[parse.trackIndex]
  track.notes.length = 0                               // replace only the drum notes
  for (const n of notes) {
    if (n.removed) continue
    track.addNote({
      midi: n.note,
      ticks: Math.max(0, Math.round(n.tick)),
      durationTicks: Math.max(1, Math.round(n.duration)),
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity))) / 127,
    })
  }
  return out
}
