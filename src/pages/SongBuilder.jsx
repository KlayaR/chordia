import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  diatonicChords, voiceChord, SCALE_NAMES, ROOT_CHOICES,
} from '../engine/song/theory'
import { PROGRESSIONS, resolveProgression } from '../engine/song/progressions'
import { ensurePiano, previewNotes, midiToNote, pianoLoaded, Tone } from '../pianoAudio'
import { isTauri, writeTempMidi, dragFile } from '../platform'
import './SongBuilder.css'

const BAR_OPTIONS = [4, 8, 12, 16]

export default function SongBuilderPage() {
  const tauri = useMemo(() => isTauri(), [])

  const [rootPc, setRootPc] = useState(0)
  const [scaleName, setScaleName] = useState('Major')
  const [tempo, setTempo] = useState(120)
  const [feel, setFeel] = useState(25)
  const [bars, setBars] = useState(8)
  const [sevenths, setSevenths] = useState(false)
  const [loop, setLoop] = useState(true)

  const [song, setSong] = useState(() => Array(8).fill(null))   // per bar: degree | null
  const [playing, setPlaying] = useState(false)
  const [pianoBusy, setPianoBusy] = useState(false)
  const [overIdx, setOverIdx] = useState(-1)

  const [blob, setBlob] = useState(null)
  const [dragPaths, setDragPaths] = useState(null)
  const dragUrlRef = useRef(null)
  const playheadRef = useRef(null)
  const rafRef = useRef(0)

  const diatonic = useMemo(() => diatonicChords(rootPc, scaleName, { sevenths }), [rootPc, scaleName, sevenths])
  const scaleFamily = scaleName.includes('Minor') || scaleName === 'Phrygian' ? 'minor' : 'major'

  // keep the song array length in sync with `bars`
  useEffect(() => {
    setSong((prev) => {
      if (prev.length === bars) return prev
      const next = prev.slice(0, bars)
      while (next.length < bars) next.push(null)
      return next
    })
  }, [bars])

  const chordAt = (i) => (song[i] ? diatonic[song[i] - 1] : null)
  const hasContent = song.some((d) => d)

  // --- rebuild export blob whenever the song / params change -----------------
  useEffect(() => {
    let cancelled = false
    if (!hasContent) { setBlob(null); setDragPaths(null); return }
    ;(async () => {
      const midi = await buildMidi()
      if (cancelled) return
      const bytes = midi.toArray()
      setBlob(new Blob([bytes], { type: 'audio/midi' }))
      if (tauri) {
        writeTempMidi(`chordia_song.mid`, bytes).then((p) => !cancelled && setDragPaths(p)).catch(() => {})
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, rootPc, scaleName, tempo, feel, sevenths])

  // --- playback --------------------------------------------------------------
  const secPerBar = (60 / tempo) * 4

  const stop = useCallback(() => {
    Tone.Transport.stop()
    Tone.Transport.cancel(0)
    cancelAnimationFrame(rafRef.current)
    if (playheadRef.current) playheadRef.current.style.left = '0%'
    setPlaying(false)
  }, [])

  const play = useCallback(async () => {
    if (!hasContent) return
    setPianoBusy(!pianoLoaded())
    const piano = await ensurePiano()
    setPianoBusy(false)

    Tone.Transport.cancel(0)
    Tone.Transport.bpm.value = tempo
    const total = bars * secPerBar

    song.forEach((deg, i) => {
      if (!deg) return
      const notes = voiceChord(diatonic[deg - 1]).map(midiToNote)
      Tone.Transport.schedule((time) => {
        notes.forEach((n, ni) => {
          const roll = (feel / 100) * 0.014 * ni
          const vel = 0.55 + Math.random() * (0.1 + (feel / 100) * 0.25)
          piano.triggerAttackRelease(n, secPerBar * 0.96, time + roll, vel)
        })
      }, i * secPerBar)
    })

    Tone.Transport.loop = loop
    Tone.Transport.loopStart = 0
    Tone.Transport.loopEnd = total
    Tone.Transport.position = 0
    Tone.Transport.start()
    setPlaying(true)

    const tick = () => {
      const t = Tone.Transport.seconds
      if (!loop && t >= total) { stop(); return }
      if (playheadRef.current) playheadRef.current.style.left = `${((t % total) / total) * 100}%`
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [hasContent, tempo, bars, secPerBar, song, diatonic, feel, loop, stop])

  useEffect(() => stop, [stop])   // stop on unmount

  const previewChord = (chord) => previewNotes(voiceChord(chord))
  const previewProg = async (prog) => {
    await ensurePiano()
    const chords = resolveProgression(prog, diatonic)
    chords.forEach((c, i) => setTimeout(() => previewNotes(voiceChord(c), 0.7), i * 420))
  }

  // --- drag & drop -----------------------------------------------------------
  const dragChord = (e, degree) => e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'chord', degree }))
  const dragProg = (e, degrees) => e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'prog', degrees }))

  const onDropCell = (e, idx) => {
    e.preventDefault()
    setOverIdx(-1)
    let payload
    try { payload = JSON.parse(e.dataTransfer.getData('text/plain')) } catch { return }
    setSong((prev) => {
      const next = [...prev]
      if (payload.kind === 'chord') next[idx] = payload.degree
      else if (payload.kind === 'prog') payload.degrees.forEach((d, k) => { if (idx + k < next.length) next[idx + k] = d })
      return next
    })
  }
  const clearCell = (idx) => setSong((prev) => prev.map((d, i) => (i === idx ? null : d)))
  const clearAll = () => setSong(Array(bars).fill(null))

  // --- MIDI build / export ---------------------------------------------------
  async function buildMidi() {
    const { Midi } = await import('@tonejs/midi')
    const midi = new Midi()
    midi.header.setTempo(tempo)
    const track = midi.addTrack()
    const barTicks = midi.header.ppq * 4
    song.forEach((deg, i) => {
      if (!deg) return
      voiceChord(diatonic[deg - 1]).forEach((m, ni) => {
        track.addNote({
          midi: m,
          ticks: i * barTicks + Math.round((feel / 100) * ni * 3),
          durationTicks: barTicks - 12,
          velocity: 0.7,
        })
      })
    })
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

  // progressions that suit the current scale first
  const progs = useMemo(() => {
    const fit = PROGRESSIONS.filter((p) => p.scaleHint === scaleFamily)
    const rest = PROGRESSIONS.filter((p) => p.scaleHint !== scaleFamily)
    return [...fit, ...rest]
  }, [scaleFamily])

  return (
    <div className="sb-page">
      <div className="sb-head">
        <h1>Song Builder</h1>
        <p className="sb-sub">Drag chords &amp; progressions onto the timeline — they adapt to your key. Hear it on a real piano.</p>
      </div>

      <div className="sb-body">
        {/* palette */}
        <aside className="sb-palette">
          <div className="sb-pal-section">
            <h3>Chords in {ROOT_CHOICES[rootPc].name} {scaleName}</h3>
            <div className="sb-chips">
              {diatonic.map((c) => (
                <div key={c.degree} className="sb-chip" draggable
                  onDragStart={(e) => dragChord(e, c.degree)} onClick={() => previewChord(c)} title="Drag to timeline · click to hear">
                  <span className="sb-chip-name">{c.name}</span>
                  <span className="sb-chip-roman">{c.roman}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="sb-pal-section">
            <h3>Progressions</h3>
            <div className="sb-progs">
              {progs.map((p) => {
                const chords = resolveProgression(p, diatonic)
                return (
                  <div key={p.name} className="sb-prog" draggable
                    onDragStart={(e) => dragProg(e, p.degrees)} onClick={() => previewProg(p)} title="Drag to timeline · click to hear">
                    <div className="sb-prog-top">
                      <span className="sb-prog-name">{p.name}</span>
                      <span className="sb-prog-cat">{p.category}</span>
                    </div>
                    <div className="sb-prog-chords">{chords.map((c) => c.name).join(' · ')}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>

        {/* main */}
        <main className="sb-main">
          <div className="sb-transport">
            <button className={`sb-play ${playing ? 'stop' : ''}`} onClick={playing ? stop : play}>
              {pianoBusy ? 'Loading piano…' : playing ? '■ Stop' : '▶ Play'}
            </button>
            <label className="sb-check"><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />Loop</label>
            <button className="sb-ghost" onClick={clearAll} disabled={!hasContent}>Clear</button>
            <div className="sb-spacer" />
            <span className="sb-tempo-read">{tempo} BPM · {ROOT_CHOICES[rootPc].name} {scaleName}</span>
          </div>

          <div className="sb-timeline">
            <div ref={playheadRef} className={`sb-playhead ${playing ? 'on' : ''}`} />
            {song.map((deg, i) => {
              const c = chordAt(i)
              return (
                <div key={i}
                  className={`sb-cell ${c ? 'filled' : ''} ${overIdx === i ? 'over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setOverIdx(i) }}
                  onDragLeave={() => setOverIdx((v) => (v === i ? -1 : v))}
                  onDrop={(e) => onDropCell(e, i)}
                  onClick={() => c && previewChord(c)}>
                  <span className="sb-cell-bar">{i + 1}</span>
                  {c ? (
                    <>
                      <span className="sb-cell-name">{c.name}</span>
                      <span className="sb-cell-roman">{c.roman}</span>
                      <button className="sb-cell-x" onClick={(e) => { e.stopPropagation(); clearCell(i) }}>×</button>
                    </>
                  ) : <span className="sb-cell-empty">＋</span>}
                </div>
              )
            })}
          </div>

          <div className="sb-params">
            <div className="sb-param">
              <label>Tempo</label>
              <div className="sb-param-row">
                <input type="range" min={50} max={220} value={tempo} onChange={(e) => setTempo(+e.target.value)} />
                <span>{tempo}</span>
              </div>
            </div>
            <div className="sb-param">
              <label>Key</label>
              <select value={rootPc} onChange={(e) => setRootPc(+e.target.value)}>
                {ROOT_CHOICES.map((r) => <option key={r.pc} value={r.pc}>{r.name}</option>)}
              </select>
            </div>
            <div className="sb-param">
              <label>Scale</label>
              <select value={scaleName} onChange={(e) => setScaleName(e.target.value)}>
                {SCALE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="sb-param">
              <label>Feel (humanize)</label>
              <div className="sb-param-row">
                <input type="range" min={0} max={100} value={feel} onChange={(e) => setFeel(+e.target.value)} />
                <span>{feel}</span>
              </div>
            </div>
            <div className="sb-param">
              <label>Bars</label>
              <select value={bars} onChange={(e) => setBars(+e.target.value)}>
                {BAR_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="sb-param">
              <label>7th chords</label>
              <label className="sb-toggle"><input type="checkbox" checked={sevenths} onChange={(e) => setSevenths(e.target.checked)} />richer</label>
            </div>
          </div>

          <div className="sb-export">
            <button className="sb-btn" onClick={download} disabled={!blob}>Download MIDI</button>
            <div className={`sb-drag ${(tauri ? dragPaths : blob) ? 'ready' : ''}`}
              draggable={!tauri && !!blob}
              onDragStart={tauri ? undefined : onWebDragStart}
              onMouseDown={tauri ? onNativeDrag : undefined}
              title={tauri ? 'Drag into your DAW' : 'Desktop app drags into Cubase directly'}>
              ⠿ Drag to DAW
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
