/**
 * Before/after piano roll for the piano humanizer. Pitch on Y (high→low),
 * time on X, notes coloured by role (melody / bass / inner) with velocity as
 * opacity. Note length reflects duration.
 */
import { useMemo } from 'react'
import './PianoRoll.css'

const ROW_H = 7
const ROLE_COLORS = { melody: '#a78fff', bass: '#3498db', inner: '#7f8694' }
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export default function PianoRoll({ before = [], after = [], ppq = 480, view = 'after' }) {
  const { lo, hi, total } = useMemo(() => {
    const all = [...before, ...after]
    if (!all.length) return { lo: 60, hi: 72, total: ppq * 4 }
    const lo = Math.min(...all.map((n) => n.note))
    const hi = Math.max(...all.map((n) => n.note))
    const maxTick = Math.max(...all.map((n) => n.start + n.dur))
    return { lo, hi, total: Math.max(maxTick + ppq, ppq * 4) }
  }, [before, after, ppq])

  const notes = (view === 'before' ? before : after)
  const rowCount = hi - lo + 1
  const plotH = rowCount * ROW_H

  // C labels
  const labels = []
  for (let note = lo; note <= hi; note++) {
    if (note % 12 === 0) labels.push({ note, top: (hi - note) * ROW_H, name: `C${Math.floor(note / 12) - 1}` })
  }

  return (
    <div className="pr-wrap">
      <div className="pr-plot" style={{ height: plotH }}>
        {labels.map((l) => (
          <div key={l.note} className="pr-cline" style={{ top: l.top + ROW_H - 1 }}><span>{l.name}</span></div>
        ))}
        {notes.map((n, k) => {
          const vel = Math.max(1, Math.min(127, n.velocity))
          const color = ROLE_COLORS[n.role] || ROLE_COLORS.inner
          return (
            <div key={k} className="pr-note" style={{
              left: `${(n.start / total) * 100}%`,
              width: `max(3px, ${(n.dur / total) * 100}%)`,
              top: (hi - n.note) * ROW_H,
              height: ROW_H - 1,
              background: color,
              opacity: 0.35 + 0.65 * (vel / 127),
            }} />
          )
        })}
      </div>
    </div>
  )
}
