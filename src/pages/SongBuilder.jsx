import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { generateSong, STRUCTURE_NAMES, NOTE_NAMES } from '../engine/song/metalcore'
import { voiceLeadEvents } from '../engine/song/voiceLead'
import { ensurePiano, midiToNote, pianoLoaded, Tone } from '../pianoAudio'
import { isTauri, writeTempMidi, dragFile } from '../platform'
import './SongBuilder.css'

const SEC_COLORS = {
  intro: '#5b6472', verse: '#1abc9c', prechorus: '#f39c12',
  chorus: '#a78fff', bridge: '#3498db', breakdown: '#e74c3c', outro: '#5b6472',
}

export default function SongBuilderPage() {
  const tauri = useMemo(() => isTauri(), [])

  const [keyRoot, setKeyRoot] = useState(4)          // E
  const [structureName, setStructureName] = useState(STRUCTURE_NAMES[0])
  const [tempo, setTempo] = useState(140)
  const [feel, setFeel] = useState(30)
  const [seed, setSeed] = useState(1)

  const [playing, setPlaying] = useState(false)
  const [pianoBusy, setPianoBusy] = useState(false)
  const [activeId, setActiveId] = useState(-1)

  const [blob, setBlob] = useState(null)
  const [dragPaths, setDragPaths] = useState(null)
  const dragUrlRef = useRef(null)
  const rafRef = useRef(0)

  // generate + voice-lead whenever the key/structure/seed changes
  const song = useMemo(() => {
    const s = generateSong({ keyRoot, structureName, seed })
    voiceLeadEvents(s.events)
    s.events.forEach((e, i) => { e.id = i })
    return s
  }, [keyRoot, structureName, seed])

  const secPerBeat = 60 / tempo

  // build export blob when song / tempo / feel change
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const midi = await buildMidi()
      if (cancelled) return
      const bytes = midi.toArray()
      setBlob(new Blob([bytes], { type: 'audio/midi' }))
      if (tauri) writeTempMidi('chordia_song.mid', bytes).then((p) => !cancelled && setDragPaths(p)).catch(() => {})
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, tempo, feel])

  const stop = useCallback(() => {
    Tone.Transport.stop(); Tone.Transport.cancel(0)
    cancelAnimationFrame(rafRef.current)
    setPlaying(false); setActiveId(-1)
  }, [])

  const play = useCallback(async () => {
    setPianoBusy(!pianoLoaded())
    const piano = await ensurePiano()
    setPianoBusy(false)

    Tone.Transport.cancel(0)
    Tone.Transport.bpm.value = tempo
    const total = song.totalBeats * secPerBeat

    for (const ev of song.events) {
      const t = ev.startBeat * secPerBeat
      const dur = ev.durBeats * secPerBeat * 0.96
      Tone.Transport.schedule((time) => {
        ev.notes.forEach((n, ni) => {
          const roll = (feel / 100) * 0.012 * ni
          const vel = 0.5 + Math.random() * (0.1 + (feel / 100) * 0.25)
          piano.triggerAttackRelease(midiToNote(n), dur, time + roll, vel)
        })
      }, t)
    }
    Tone.Transport.loop = true
    Tone.Transport.loopStart = 0
    Tone.Transport.loopEnd = total
    Tone.Transport.position = 0
    Tone.Transport.start()
    setPlaying(true)

    const tick = () => {
      const beat = (Tone.Transport.seconds / secPerBeat) % song.totalBeats
      const ev = song.events.find((e) => beat >= e.startBeat && beat < e.startBeat + e.durBeats)
      setActiveId(ev ? ev.id : -1)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [song, tempo, secPerBeat, feel])

  useEffect(() => stop, [stop])

  async function buildMidi() {
    const { Midi } = await import('@tonejs/midi')
    const midi = new Midi()
    midi.header.setTempo(tempo)
    const track = midi.addTrack()
    const ppb = midi.header.ppq
    for (const ev of song.events) {
      ev.notes.forEach((n, ni) => {
        track.addNote({
          midi: n,
          ticks: Math.round(ev.startBeat * ppb + (feel / 100) * ni * 3),
          durationTicks: Math.max(1, Math.round(ev.durBeats * ppb) - 8),
          velocity: 0.7,
        })
      })
    }
    return midi
  }

  const download = () => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'chordia_song.mid'; a.click()
  }
  const onWebDragStart = (e) => {
    if (!blob) { e.preventDefault(); return }
    if (dragUrlRef.current) URL.revokeObjectURL(dragUrlRef.current)
    const url = URL.createObjectURL(blob); dragUrlRef.current = url
    e.dataTransfer.setData('DownloadURL', `audio/midi:chordia_song.mid:${url}`)
  }
  const onNativeDrag = () => { if (dragPaths) dragFile(dragPaths.file, dragPaths.icon).catch(() => {}) }

  return (
    <div className="sb-page">
      <div className="sb-head">
        <h1>Song Builder</h1>
        <p className="sb-sub">Generate a full melodic-metalcore song — voice-led chords on a real piano. Regenerate for variations.</p>
      </div>

      {/* controls */}
      <div className="sb-controls">
        <div className="sb-ctl">
          <label>Structure</label>
          <select value={structureName} onChange={(e) => setStructureName(e.target.value)}>
            {STRUCTURE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="sb-ctl">
          <label>Key (minor)</label>
          <select value={keyRoot} onChange={(e) => setKeyRoot(+e.target.value)}>
            {NOTE_NAMES.map((n, pc) => <option key={pc} value={pc}>{n}m</option>)}
          </select>
        </div>
        <div className="sb-ctl">
          <label>Tempo</label>
          <div className="sb-ctl-row"><input type="range" min={70} max={200} value={tempo} onChange={(e) => setTempo(+e.target.value)} /><span>{tempo}</span></div>
        </div>
        <div className="sb-ctl">
          <label>Feel</label>
          <div className="sb-ctl-row"><input type="range" min={0} max={100} value={feel} onChange={(e) => setFeel(+e.target.value)} /><span>{feel}</span></div>
        </div>
        <button className="sb-regen" onClick={() => setSeed((s) => s + 1)}>🎲 Regenerate</button>
      </div>

      {/* transport */}
      <div className="sb-transport">
        <button className={`sb-play ${playing ? 'stop' : ''}`} onClick={playing ? stop : play}>
          {pianoBusy ? 'Loading piano…' : playing ? '■ Stop' : '▶ Play'}
        </button>
        <span className="sb-meta">{NOTE_NAMES[keyRoot]} minor · {song.totalBars} bars · {song.sections.length} sections</span>
        <div className="sb-spacer" />
        <button className="sb-btn" onClick={download} disabled={!blob}>Download MIDI</button>
        <div className={`sb-drag ${(tauri ? dragPaths : blob) ? 'ready' : ''}`}
          draggable={!tauri && !!blob}
          onDragStart={tauri ? undefined : onWebDragStart}
          onMouseDown={tauri ? onNativeDrag : undefined}
          title={tauri ? 'Drag into your DAW' : 'Desktop app drags into Cubase directly'}>
          ⠿ Drag to DAW
        </div>
      </div>

      {/* song map */}
      <div className="sb-map">
        {song.sections.map((sec, si) => {
          const total = sec.events.reduce((s, e) => s + e.durBeats, 0)
          return (
            <div key={si} className="sb-section">
              <div className="sb-sec-label" style={{ background: SEC_COLORS[sec.type] }}>
                <span className="sb-sec-name">{sec.type}</span>
                <span className="sb-sec-bars">{sec.bars}b{sec.pedal ? ' · pedal' : ''}</span>
              </div>
              <div className="sb-sec-chords">
                {sec.events.map((ev) => (
                  <div key={ev.id}
                    className={`sb-chordblk ${activeId === ev.id ? 'active' : ''}`}
                    style={{ flexGrow: ev.durBeats, borderColor: SEC_COLORS[sec.type] }}
                    title={`${ev.roman} · ${ev.durBeats} beats`}>
                    <span className="sb-chordblk-name">{ev.chord.name}</span>
                    <span className="sb-chordblk-roman">{ev.roman}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
