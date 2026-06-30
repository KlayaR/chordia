import { useState, useMemo, useCallback, useEffect } from 'react'
import PianoKeyboard from '../components/PianoKeyboard'
import { findScales, detectFromFile, extraNotes, scaleMidiNotes, noteName } from '../engine/scales'
import { playNote, playChord, playSequence } from '../audio'
import './ScaleFinder.css'

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

export default function ScaleFinderPage() {
  useBlockBrowserFileDrop()
  const [selected, setSelected] = useState(() => new Set())
  const [scaleHi, setScaleHi]   = useState(() => new Set())
  const [hoverSound, setHoverSound] = useState(true)
  const [detection, setDetection] = useState(null)   // { top, list, count }
  const [detectErr, setDetectErr] = useState('')
  const [dropping, setDropping] = useState(false)

  const candidates = useMemo(() => findScales(selected), [selected])

  const onHover = useCallback((midi) => { if (hoverSound) playNote(midi) }, [hoverSound])
  const onPress = useCallback((midi) => playNote(midi), [])
  const onToggle = useCallback((pc) => {
    setScaleHi(new Set())
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(pc) ? next.delete(pc) : next.add(pc)
      return next
    })
  }, [])

  const clearAll = () => { setSelected(new Set()); setScaleHi(new Set()); setDetection(null); setDetectErr('') }
  const playSelection = () => {
    const midis = scaleMidiNotes(selected)
    if (midis.length) playChord(midis.slice(0, -1))
  }
  const auditionScale = (m) => {
    setScaleHi(new Set(m.pcs))
    playSequence(scaleMidiNotes(m.pcs))
  }

  const detectFile = useCallback(async (file) => {
    if (!file) return
    setDetectErr('')
    try {
      const { matches, weights, count } = await detectFromFile(file)
      if (!matches.length || count === 0) {
        setDetection(null)
        setDetectErr('No pitched (non-drum) notes found to analyse.')
        return
      }
      const peak = Math.max(...weights) || 1
      const present = new Set(weights.map((w, pc) => (w > 0.02 * peak ? pc : -1)).filter((p) => p >= 0))
      setSelected(present)
      setScaleHi(new Set(matches[0].pcs))
      setDetection({ top: matches[0], list: matches, count, name: file.name })
    } catch (e) {
      setDetection(null)
      setDetectErr(`Could not read MIDI: ${e.message}`)
    }
  }, [])

  const onDrop = (e) => { e.preventDefault(); setDropping(false); detectFile(e.dataTransfer.files[0]) }

  const selLabel = selected.size
    ? [...selected].sort((a, b) => a - b).map(noteName).join('  ')
    : '—'

  return (
    <div className="sf-page">
      <div className="sf-head">
        <h1>Scale Finder</h1>
        <p className="sf-sub">Hover to hear · click keys to build a chord/scale · the list narrows as you add notes</p>
      </div>

      <PianoKeyboard
        lowNote={48} octaves={3}
        selected={selected} scale={scaleHi}
        onHover={onHover} onPress={onPress} onToggle={onToggle}
      />

      <div className="sf-controls">
        <span className="sf-selected">Selected: <b>{selLabel}</b></span>
        <label className="sf-check">
          <input type="checkbox" checked={hoverSound} onChange={(e) => setHoverSound(e.target.checked)} />
          Sound on hover
        </label>
        <button className="sf-btn" onClick={playSelection} disabled={!selected.size}>▶ Play</button>
        <button className="sf-btn ghost" onClick={clearAll}>Clear</button>
      </div>

      <div className="sf-cols">
        {/* candidates */}
        <section className="sf-col">
          <h2 className="sf-title">Possible scales {candidates.length ? `(${candidates.length})` : ''}</h2>
          <div className="sf-list">
            {candidates.length === 0 && <p className="sf-empty">Click notes on the keyboard to see matching scales.</p>}
            {candidates.map((m, i) => (
              <button key={i} className={`sf-item ${m.exact ? 'exact' : ''}`} onClick={() => auditionScale(m)}>
                <span className="sf-item-name">{m.fullName}</span>
                {m.exact
                  ? <span className="sf-tag ok">✓ exact</span>
                  : <span className="sf-tag">+{m.extra}: {extraNotes(m, selected).join(', ')}</span>}
              </button>
            ))}
          </div>
        </section>

        {/* detection */}
        <section className="sf-col">
          <h2 className="sf-title">Detect scale from a MIDI file</h2>
          <div
            className={`sf-drop ${dropping ? 'over' : ''}`}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDropping(true) }}
            onDragLeave={() => setDropping(false)}
          >
            <label className="sf-drop-label">
              <input type="file" accept=".mid,.midi" hidden onChange={(e) => detectFile(e.target.files[0])} />
              {detection ? detection.name : 'Drop a MIDI here or '}
              {!detection && <span className="sf-browse">browse</span>}
            </label>
          </div>

          {detectErr && <p className="sf-err">{detectErr}</p>}
          {detection && (
            <div className="sf-result">
              <b>{detection.top.fullName}</b>
              <span className="sf-result-meta">
                match {Math.round(detection.top.score * 100)}% · covers {Math.round(detection.top.coverage * 100)}% · {detection.count} notes
              </span>
            </div>
          )}

          <div className="sf-list">
            {detection?.list.map((m, i) => (
              <button key={i} className="sf-item" onClick={() => auditionScale(m)}>
                <span className="sf-item-name">{m.fullName}</span>
                <span className="sf-tag">{Math.round(m.score * 100)}% · {Math.round(m.coverage * 100)}% cover</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
