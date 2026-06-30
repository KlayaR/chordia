import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { parsePiano } from '../engine/piano/pianoAnalyze'
import { humanizePiano, exportPiano } from '../engine/piano/pianoHumanizer'
import { STYLE_NAMES, DEFAULT_STYLE } from '../engine/piano/pianoStyles'
import { isTauri, writeTempMidi, dragFile } from '../platform'
import PianoRoll from '../components/PianoRoll'
import './Humanizer.css'

const STYLE_DESC = {
  Pop: 'Tight & present — modest lead, light pedal',
  Cinematic: 'Wide dynamics, big rubato + roll, lush pedal',
  Metalcore: 'Hard accents, minimal rubato, tight pedal',
}

function Slider({ label, value, set, min, max, suffix }) {
  return (
    <div className="hz-slider">
      <div className="hz-slider-head"><span>{label}</span><b>{value}{suffix}</b></div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(+e.target.value)} />
    </div>
  )
}

function useBlockBrowserFileDrop() {
  useEffect(() => {
    const block = (e) => e.preventDefault()
    document.addEventListener('dragover', block)
    document.addEventListener('drop', block)
    return () => { document.removeEventListener('dragover', block); document.removeEventListener('drop', block) }
  }, [])
}

export default function PianoHumanizerPage() {
  useBlockBrowserFileDrop()
  const tauri = useMemo(() => isTauri(), [])

  const [parse, setParse] = useState(null)
  const [filename, setFilename] = useState('')
  const [styleName, setStyleName] = useState(DEFAULT_STYLE)
  const [voicing, setVoicing] = useState(100)
  const [timing, setTiming] = useState(75)

  const [result, setResult] = useState(null)
  const [view, setView] = useState('after')
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dropping, setDropping] = useState(false)

  const [blob, setBlob] = useState(null)
  const [outName, setOutName] = useState('')
  const [dragPaths, setDragPaths] = useState(null)
  const [dawDragging, setDawDragging] = useState(false)
  const [dragStatus, setDragStatus] = useState('')
  const dragUrlRef = useRef(null)

  const handleFile = useCallback(async (file) => {
    if (!file) return
    setLoading(true); setError(null); setParse(null); setSummary([]); setResult(null)
    try {
      const p = await parsePiano(file)
      if (!p.notes.length) throw new Error('No pitched notes found in this MIDI.')
      setParse(p); setFilename(file.name)
    } catch (e) {
      setError(e.message === 'NO_PITCHED_NOTES' ? 'No pitched (non-drum) notes found.' : e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!parse) { setBlob(null); setDragPaths(null); setSummary([]); setResult(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = humanizePiano(parse, styleName, { voicingIntensity: voicing, timingIntensity: timing, seed: 1 })
        const midi = await exportPiano(res)
        if (cancelled) return
        setResult(res)
        const bytes = midi.toArray()
        setBlob(new Blob([bytes], { type: 'audio/midi' }))
        const base = filename.replace(/\.midi?$/i, '')
        const fname = `${base}_piano.mid`
        setOutName(fname); setSummary(res.summaryLines())
        if (tauri) { setDragPaths(null); writeTempMidi(fname, bytes).then((p) => !cancelled && setDragPaths(p)).catch(() => {}) }
      } catch (e) {
        if (!cancelled) { setError(`Humanize failed: ${e.message}`); setBlob(null) }
      }
    })()
    return () => { cancelled = true }
  }, [parse, styleName, voicing, timing, filename, tauri])

  const onDrop = (e) => { e.preventDefault(); setDropping(false); handleFile(e.dataTransfer.files[0]) }
  const onFileInput = (e) => handleFile(e.target.files[0])
  const download = () => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = outName; a.click() }
  const onWebDragStart = (e) => {
    if (!blob) { e.preventDefault(); return }
    if (dragUrlRef.current) URL.revokeObjectURL(dragUrlRef.current)
    const url = URL.createObjectURL(blob); dragUrlRef.current = url
    e.dataTransfer.setData('DownloadURL', `audio/midi:${outName}:${url}`); e.dataTransfer.effectAllowed = 'copy'
  }
  const onNativeDrag = (e) => {
    if (e.button !== 0 || !dragPaths) return
    setDawDragging(true); setDragStatus('dragging…')
    dragFile(dragPaths.file, dragPaths.icon, (p) => { setDawDragging(false); setDragStatus(p?.result === 'Dropped' ? 'dropped ✓' : 'cancelled') })
      .catch((err) => { setDawDragging(false); setDragStatus('error: ' + (err?.message ?? err)) })
  }
  const dragReady = tauri ? !!dragPaths : !!blob

  return (
    <div className="hz-page">
      <div className="hz-head">
        <h1>Piano Humanizer</h1>
        <p className="hz-sub">Voice a chords + melody MIDI — bring out the melody, shape dynamics, add timing &amp; sustain pedal</p>
      </div>

      <div className={`hz-drop ${dropping ? 'over' : ''} ${parse ? 'loaded' : ''}`}
        onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); setDropping(true) }} onDragLeave={() => setDropping(false)}>
        {loading ? <span className="hz-drop-label">Analysing…</span>
          : parse ? (
            <div className="hz-loaded">
              <span className="hz-filename">{filename}</span>
              <span className="hz-meta">{parse.notes.length} notes · {parse.events.length} chords</span>
              <label className="hz-replace"><input type="file" accept=".mid,.midi" hidden onChange={onFileInput} />Replace file</label>
            </div>
          ) : (
            <label className="hz-drop-label">
              <input type="file" accept=".mid,.midi" hidden onChange={onFileInput} />
              Drop a piano MIDI here or <span className="hz-browse">browse</span>
            </label>
          )}
      </div>

      {error && <p className="hz-error">{error}</p>}

      {parse && (
        <>
          <section className="hz-section">
            <h2 className="hz-title">Style</h2>
            <div className="ph-styles">
              {STYLE_NAMES.map((s) => (
                <button key={s} className={`ph-style ${styleName === s ? 'active' : ''}`} onClick={() => setStyleName(s)}>
                  <span className="ph-style-name">{s}</span>
                  <span className="ph-style-desc">{STYLE_DESC[s]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="hz-section">
            <h2 className="hz-title">Humanization</h2>
            <Slider label="Voicing (melody / balance / dynamics)" value={voicing} set={setVoicing} min={0} max={100} suffix="%" />
            <Slider label="Timing (lead / roll / rubato)" value={timing} set={setTiming} min={0} max={100} suffix="%" />
          </section>

          {result && (
            <section className="hz-section">
              <div className="hz-roll-head">
                <h2 className="hz-title">Piano roll</h2>
                <div className="hz-toggle">
                  <button className={view === 'before' ? 'on' : ''} onClick={() => setView('before')}>Before</button>
                  <button className={view === 'after' ? 'on' : ''} onClick={() => setView('after')}>After</button>
                </div>
              </div>
              <div className="hz-legend">
                <span style={{ color: '#a78fff' }}>●</span> Melody
                <span style={{ color: '#3498db' }}>●</span> Bass
                <span style={{ color: '#7f8694' }}>●</span> Inner
              </div>
              <PianoRoll before={result.originalNotes} after={result.notes} ppq={parse.ppq} view={view} />
            </section>
          )}

          {summary.length > 0 && (
            <section className="hz-section">
              <h2 className="hz-title">Report</h2>
              <pre className="hz-report">{summary.join('\n')}</pre>
            </section>
          )}

          <section className="hz-section">
            <h2 className="hz-title">Export{tauri && <span className="hz-badge">● Desktop{dragPaths ? ' · ready' : ' · preparing…'}</span>}</h2>
            <div className="hz-export-row">
              <button className="hz-btn" onClick={download} disabled={!blob}>Download MIDI</button>
              <div
                draggable={!tauri && dragReady}
                onDragStart={tauri ? undefined : onWebDragStart}
                onMouseDown={tauri ? onNativeDrag : undefined}
                className={`hz-drag ${dragReady ? 'ready' : ''} ${dawDragging ? 'dragging' : ''}`}
                title={tauri ? 'Drag into your DAW' : 'Desktop app drags into Cubase directly'}>
                ⠿ Drag to DAW
              </div>
              {tauri && dragStatus && <span className="hz-drag-status">{dragStatus}</span>}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
