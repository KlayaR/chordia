import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { parseDrums } from '../engine/drums/drumParser'
import { humanize, exportResult } from '../engine/drums/drumHumanizer'
import { DRUM_MAPS, DRUM_MAP_NAMES, DEFAULT_MAP } from '../engine/drums/drumMaps'
import { isTauri, writeTempMidi, dragFile } from '../platform'
import './Humanizer.css'

function useBlockBrowserFileDrop() {
  useEffect(() => {
    const block = (e) => e.preventDefault()
    document.addEventListener('dragover', block)
    document.addEventListener('drop', block)
    return () => {
      document.removeEventListener('dragover', block)
      document.removeEventListener('drop', block)
    }
  }, [])
}

function Slider({ label, value, set, min, max, suffix }) {
  return (
    <div className="hz-slider">
      <div className="hz-slider-head"><span>{label}</span><b>{value}{suffix}</b></div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(+e.target.value)} />
    </div>
  )
}

export default function HumanizerPage() {
  useBlockBrowserFileDrop()
  const tauri = useMemo(() => isTauri(), [])

  const [parse, setParse] = useState(null)
  const [filename, setFilename] = useState('')
  const [mapName, setMapName] = useState(DEFAULT_MAP)
  const [vel, setVel] = useState(100)
  const [timing, setTiming] = useState(75)
  const [feel, setFeel] = useState(0)

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
    setLoading(true); setError(null); setParse(null); setSummary([])
    try {
      const p = await parseDrums(file, DRUM_MAPS[mapName] || DRUM_MAPS[DEFAULT_MAP])
      if (!p.notes.length) throw new Error('No drum notes found (looked for channel 10, then the busiest track).')
      setParse(p); setFilename(file.name)
    } catch (e) {
      setError(e.message === 'NO_DRUM_TRACK' ? 'No drum track found in this MIDI.' : e.message)
    } finally {
      setLoading(false)
    }
  }, [mapName])

  // humanize whenever inputs change (re-map voices first so a map switch applies)
  useEffect(() => {
    if (!parse) { setBlob(null); setDragPaths(null); setSummary([]); return }
    let cancelled = false
    ;(async () => {
      try {
        const map = DRUM_MAPS[mapName] || DRUM_MAPS[DEFAULT_MAP]
        for (const n of parse.notes) n.voice = map.voice(n.note)
        const result = humanize(parse, map, { velocityIntensity: vel, timingIntensity: timing, feel, seed: 1 })
        const midi = await exportResult(result)
        if (cancelled) return
        const bytes = midi.toArray()
        setBlob(new Blob([bytes], { type: 'audio/midi' }))
        const base = filename.replace(/\.midi?$/i, '')
        const fname = `${base}_humanized.mid`
        setOutName(fname)
        setSummary(result.reporter.summaryLines())
        if (tauri) {
          setDragPaths(null)
          writeTempMidi(fname, bytes).then((p) => !cancelled && setDragPaths(p)).catch(() => {})
        }
      } catch (e) {
        if (!cancelled) { setError(`Humanize failed: ${e.message}`); setBlob(null) }
      }
    })()
    return () => { cancelled = true }
  }, [parse, mapName, vel, timing, feel, filename, tauri])

  const onDrop = (e) => { e.preventDefault(); setDropping(false); handleFile(e.dataTransfer.files[0]) }
  const onFileInput = (e) => handleFile(e.target.files[0])

  const download = () => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = outName; a.click()
  }

  const onWebDragStart = (e) => {
    if (!blob) { e.preventDefault(); return }
    if (dragUrlRef.current) URL.revokeObjectURL(dragUrlRef.current)
    const url = URL.createObjectURL(blob); dragUrlRef.current = url
    e.dataTransfer.setData('DownloadURL', `audio/midi:${outName}:${url}`)
    e.dataTransfer.effectAllowed = 'copy'
  }
  const onNativeDrag = (e) => {
    if (e.button !== 0 || !dragPaths) return
    setDawDragging(true); setDragStatus('dragging…')
    dragFile(dragPaths.file, dragPaths.icon, (p) => {
      setDawDragging(false); setDragStatus(p?.result === 'Dropped' ? 'dropped ✓' : 'cancelled')
    }).catch((err) => { setDawDragging(false); setDragStatus('error: ' + (err?.message ?? err)) })
  }
  const dragReady = tauri ? !!dragPaths : !!blob

  return (
    <div className="hz-page">
      <div className="hz-head">
        <h1>Drum Humanizer</h1>
        <p className="hz-sub">Program drums like a real drummer — Nolly's GGD M&amp;M 2 profile</p>
      </div>

      <div className={`hz-drop ${dropping ? 'over' : ''} ${parse ? 'loaded' : ''}`}
        onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); setDropping(true) }} onDragLeave={() => setDropping(false)}>
        {loading ? <span className="hz-drop-label">Analysing…</span>
          : parse ? (
            <div className="hz-loaded">
              <span className="hz-filename">{filename}</span>
              <span className="hz-meta">{parse.notes.length} drum notes · {parse.totalBars} bars</span>
              <label className="hz-replace"><input type="file" accept=".mid,.midi" hidden onChange={onFileInput} />Replace file</label>
            </div>
          ) : (
            <label className="hz-drop-label">
              <input type="file" accept=".mid,.midi" hidden onChange={onFileInput} />
              Drop a drum MIDI here or <span className="hz-browse">browse</span>
            </label>
          )}
      </div>

      {error && <p className="hz-error">{error}</p>}

      {parse && (
        <>
          <section className="hz-section">
            <h2 className="hz-title">Drum map</h2>
            <select className="hz-select" value={mapName} onChange={(e) => setMapName(e.target.value)}>
              {DRUM_MAP_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </section>

          <section className="hz-section">
            <h2 className="hz-title">Humanization</h2>
            <Slider label="Velocity (toward Nolly targets)" value={vel} set={setVel} min={0} max={100} suffix="%" />
            <Slider label="Timing (groove + feel humanization)" value={timing} set={setTiming} min={0} max={100} suffix="%" />
            <Slider label="Feel (− push · + laid-back)" value={feel} set={setFeel} min={-100} max={100} suffix="" />
          </section>

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
                title={tauri ? "Drag into your DAW" : "Desktop app drags into Cubase directly"}>
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
