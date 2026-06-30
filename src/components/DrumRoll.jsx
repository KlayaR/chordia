/**
 * Before/after drum piano roll (ported from MidiHuman's PianoRollCanvas).
 * Lanes = voices present (cymbals top → kick bottom), notes coloured by voice
 * type with velocity driving both opacity and bar height.
 */
import { useMemo } from 'react'
import { TYPE_COLORS } from '../engine/drums/drumMaps'
import './DrumRoll.css'

const ROW_H = 20

function rgba(hex, alpha255) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${(alpha255 / 255).toFixed(2)})`
}

export default function DrumRoll({ before = [], after = [], drumMap, ppq = 480, view = 'after' }) {
  const { rows, total } = useMemo(() => {
    const all = [...before, ...after]
    const present = new Set(all.map((n) => n.note))
    const rows = []
    if (drumMap) {
      for (const v of [...drumMap.orderedVoices()].reverse()) {
        if (present.has(v.note)) rows.push({ note: v.note, name: v.name, vtype: v.vtype })
      }
    }
    for (const note of [...present].sort((a, b) => a - b)) {
      if (!rows.some((r) => r.note === note)) rows.push({ note, name: `Note ${note}`, vtype: 'unknown' })
    }
    const maxTick = all.length ? Math.max(...all.map((n) => n.tick)) : ppq * 4
    return { rows, total: Math.max(maxTick + ppq, ppq * 4) }
  }, [before, after, drumMap, ppq])

  if (!rows.length) return <div className="dr-empty">No drum notes to display</div>

  const rowIndex = new Map(rows.map((r, i) => [r.note, i]))
  const notes = (view === 'before' ? before : after).filter((n) => !n.removed)

  const barTicks = ppq * 4
  const bars = []
  for (let t = 0, b = 0; t <= total; t += barTicks, b += 1) bars.push({ left: (t / total) * 100, label: b + 1 })

  const plotH = rows.length * ROW_H

  return (
    <div className="drum-roll">
      <div className="dr-labels" style={{ height: plotH }}>
        {rows.map((r) => (
          <div className="dr-label" key={r.note} style={{ height: ROW_H }} title={r.name}>{r.name}</div>
        ))}
      </div>
      <div className="dr-plot" style={{ height: plotH }}>
        {rows.map((r, i) => (
          <div key={r.note} className="dr-stripe" data-odd={i % 2} style={{ top: i * ROW_H, height: ROW_H }} />
        ))}
        {bars.map((bar, i) => (
          <div key={`bar${i}`} className="dr-bar" style={{ left: `${bar.left}%` }}>
            <span className="dr-bar-num">{bar.label}</span>
          </div>
        ))}
        {notes.map((n, k) => {
          const ri = rowIndex.get(n.note)
          if (ri == null) return null
          const vel = Math.max(1, Math.min(127, n.velocity))
          const h = Math.max(3, ROW_H * 0.85 * (0.35 + 0.65 * (vel / 127)))
          const color = rgba(TYPE_COLORS[n.voice?.vtype] || TYPE_COLORS.unknown, 60 + (vel / 127) * 195)
          return (
            <div key={k} className="dr-note"
              style={{ left: `${(n.tick / total) * 100}%`, top: ri * ROW_H + (ROW_H - h) / 2, height: h, background: color }} />
          )
        })}
      </div>
    </div>
  )
}
