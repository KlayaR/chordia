import { useState, useCallback, useEffect, useRef } from 'react'

// Prevent the browser from navigating to a dropped file if it misses the drop zone
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
import { parseChordsFromFile } from '../engine/parseChords'
import { detectChordsForEvents } from '../engine/detectChord'
import { voiceEvents, TARGETS } from '../engine/voicer'
import { buildOutputMidi, downloadMidi, midiToBlob } from '../engine/buildMidi'
import './Voicer.css'

const TARGET_ICONS = {
  orchestra: '🎻',
  strings:   '🎼',
  brass:     '🎺',
  choir:     '🎤',
  piano:     '🎹',
}

const TARGET_DESC = {
  orchestra: 'Wide spread · sub-bass to high · heavy doublings',
  strings:   'A2–E5 · tight ensemble voicing',
  brass:     'Bb2–Bb4 · punchy open register',
  choir:     'SATB · C3–C5 · 4 close voices',
  piano:     'Root LH · chord RH · 2-hand span',
}

export default function VoicerPage() {
  useBlockBrowserFileDrop()
  const [dropping, setDropping] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [parsed, setParsed]     = useState(null)
  const [target, setTarget]     = useState('orchestra')
  const [voicedBlob, setVoicedBlob]         = useState(null)
  const [voicedFilename, setVoicedFilename] = useState('')
  const [dawDragging, setDawDragging]       = useState(false)
  const dragUrlRef = useRef(null)

  // Recompute voiced MIDI whenever source or target changes
  useEffect(() => {
    if (!parsed) { setVoicedBlob(null); return }
    try {
      const voiced = voiceEvents(parsed.events, target)
      const outMidi = buildOutputMidi(parsed.midi, voiced)
      setVoicedBlob(midiToBlob(outMidi))
      const base = parsed.filename.replace(/\.midi?$/i, '')
      setVoicedFilename(`${base}_${target}.mid`)
    } catch (e) {
      console.error('Voice/build error:', e)
      setError(`Failed to build output: ${e.message}`)
      setVoicedBlob(null)
    }
  }, [parsed, target])

  const handleFile = useCallback(async (file) => {
    if (!file) return
    setLoading(true)
    setError(null)
    setParsed(null)
    try {
      const { events, ppq, midi } = await parseChordsFromFile(file)
      if (events.length === 0) throw new Error('No pitched notes found in this MIDI file.')
      const withChords = detectChordsForEvents(events)
      setParsed({ events: withChords, ppq, midi, filename: file.name })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDropping(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onDragOver  = (e) => { e.preventDefault(); setDropping(true) }
  const onDragLeave = () => setDropping(false)
  const onFileInput = (e) => handleFile(e.target.files[0])

  const handleExport = () => {
    if (!voicedBlob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(voicedBlob)
    a.download = voicedFilename
    a.click()
  }

  // DAW drag — DownloadURL tells Chrome to hand a real file to the OS drag target
  const onDawDragStart = useCallback((e) => {
    if (!voicedBlob) { e.preventDefault(); return }
    if (dragUrlRef.current) URL.revokeObjectURL(dragUrlRef.current)
    const url = URL.createObjectURL(voicedBlob)
    dragUrlRef.current = url
    e.dataTransfer.setData('DownloadURL', `audio/midi:${voicedFilename}:${url}`)
    e.dataTransfer.effectAllowed = 'copy'
    setDawDragging(true)
  }, [voicedBlob, voicedFilename])

  const onDawDragEnd = useCallback(() => {
    setDawDragging(false)
    // Delay revoke so Chrome finishes the transfer
    setTimeout(() => {
      if (dragUrlRef.current) { URL.revokeObjectURL(dragUrlRef.current); dragUrlRef.current = null }
    }, 5000)
  }, [])

  return (
    <div className="voicer-page">
      <div className="voicer-header">
        <h1>Voicer</h1>
        <p className="voicer-sub">Drop a MIDI file · pick a target · export re-voiced chords</p>
      </div>

      {/* MIDI drop zone */}
      <div
        className={`drop-zone ${dropping ? 'drag-over' : ''} ${parsed ? 'has-file' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        {loading ? (
          <span className="drop-label">Analysing…</span>
        ) : parsed ? (
          <div className="drop-loaded">
            <span className="drop-filename">{parsed.filename}</span>
            <span className="drop-meta">{parsed.events.length} chord events detected</span>
            <label className="drop-replace">
              <input type="file" accept=".mid,.midi" onChange={onFileInput} hidden />
              Replace file
            </label>
          </div>
        ) : (
          <label className="drop-label">
            <input type="file" accept=".mid,.midi" onChange={onFileInput} hidden />
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Drop MIDI here or <span className="browse">browse</span>
          </label>
        )}
      </div>

      {error && <p className="voicer-error">{error}</p>}

      {parsed && (
        <>
          {/* Chord list */}
          <section className="section">
            <h2 className="section-title">Detected progression</h2>
            <div className="chord-list">
              {parsed.events.map((ev, i) => (
                <span key={i} className={`chord-chip ${!ev.chord || ev.chord.quality === 'unknown' ? 'unknown' : ''}`}>
                  {ev.chord?.symbol ?? '?'}
                </span>
              ))}
            </div>
          </section>

          {/* Target picker */}
          <section className="section">
            <h2 className="section-title">Voice for</h2>
            <div className="target-grid">
              {Object.keys(TARGETS).map(key => (
                <button
                  key={key}
                  className={`target-btn ${target === key ? 'active' : ''}`}
                  onClick={() => setTarget(key)}
                >
                  <span className="target-icon">{TARGET_ICONS[key]}</span>
                  <span className="target-name">{TARGETS[key].label}</span>
                  <span className="target-desc">{TARGET_DESC[key]}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Export + DAW drag */}
          <section className="section">
            <h2 className="section-title">Export</h2>
            <div className="export-row">
              <button className="export-btn" onClick={handleExport}>
                Download MIDI
              </button>

              <div
                draggable={!!voicedBlob}
                onDragStart={onDawDragStart}
                onDragEnd={onDawDragEnd}
                className={`daw-drag ${voicedBlob ? 'ready' : ''} ${dawDragging ? 'dragging' : ''}`}
                title="Drag this into your DAW's arrange window"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9"  cy="5"  r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="9"  cy="12" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="9"  cy="19" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="15" cy="5"  r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="15" cy="19" r="1.5" fill="currentColor" stroke="none"/>
                </svg>
                <span>Drag to DAW</span>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
