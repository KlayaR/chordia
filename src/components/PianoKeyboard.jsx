/**
 * Interactive multi-octave piano keyboard (SVG).
 * Hover a key → onHover(midi); press → onPress(midi) + onToggle(pc).
 * `selected` and `scale` are Sets of pitch classes, highlighted across octaves.
 */
import { useState } from 'react'

const WHITE_SEMIS = [0, 2, 4, 5, 7, 9, 11]
// semitone -> which white-key boundary (within an octave) the black key sits over
const BLACK_BOUNDARY = [[1, 1], [3, 2], [6, 4], [8, 5], [10, 6]]

const VB_W = 700
const VB_H = 170

function bottomRounded(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  return `M${x},${y} L${x + w},${y} L${x + w},${y + h - r} `
    + `Q${x + w},${y + h} ${x + w - r},${y + h} L${x + r},${y + h} `
    + `Q${x},${y + h} ${x},${y + h - r} Z`
}

export default function PianoKeyboard({
  lowNote = 48, octaves = 3,
  selected = new Set(), scale = new Set(),
  onHover, onPress, onToggle,
}) {
  const [hover, setHover] = useState(null)

  const numWhite = 7 * octaves
  const ww = VB_W / numWhite
  const wh = VB_H
  const bw = ww * 0.62
  const bh = wh * 0.62

  const whites = []
  for (let o = 0; o < octaves; o++) {
    const base = lowNote + o * 12
    WHITE_SEMIS.forEach((s, k) => whites.push({ midi: base + s, idx: o * 7 + k }))
  }
  const blacks = []
  for (let o = 0; o < octaves; o++) {
    const base = lowNote + o * 12
    for (const [semi, boundary] of BLACK_BOUNDARY) {
      const cx = (o * 7 + boundary) * ww
      blacks.push({ midi: base + semi, x: cx - bw / 2 })
    }
  }

  const enter = (midi) => { setHover(midi); onHover?.(midi) }
  const press = (midi) => { onPress?.(midi); onToggle?.(midi % 12) }

  return (
    <svg
      className="piano-kbd"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="wn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3f5f8" /><stop offset="1" stopColor="#cdd1d8" />
        </linearGradient>
        <linearGradient id="ws" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#54e6c8" /><stop offset="1" stopColor="#16b89a" />
        </linearGradient>
        <linearGradient id="wsc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b3a6f5" /><stop offset="1" stopColor="#8f7cf0" />
        </linearGradient>
        <linearGradient id="bn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#46494f" /><stop offset="1" stopColor="#0d0e10" />
        </linearGradient>
        <linearGradient id="bs" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1ed7b4" /><stop offset="1" stopColor="#0d8f78" />
        </linearGradient>
        <linearGradient id="bsc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8f7cf0" /><stop offset="1" stopColor="#4a3da0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={VB_W} height={VB_H} fill="#17181b" />

      {/* white keys */}
      {whites.map(({ midi, idx }) => {
        const pc = midi % 12
        const fill = selected.has(pc) ? 'url(#ws)' : scale.has(pc) ? 'url(#wsc)' : 'url(#wn)'
        const x = idx * ww + 0.5
        const w = ww - 1
        return (
          <g key={`w${midi}`}>
            <path
              d={bottomRounded(x, 0, w, wh, 5)} fill={fill}
              stroke="#0e0f11" strokeWidth="1"
              onMouseEnter={() => enter(midi)}
              onMouseDown={() => press(midi)}
              style={{ cursor: 'pointer' }}
            />
            {midi === hover && (
              <path d={bottomRounded(x, 0, w, wh, 5)} fill="#ffffff" opacity="0.12" pointerEvents="none" />
            )}
            {pc === 0 && (
              <text x={x + w / 2} y={wh - 8} fill="#6a6f77" fontSize="11"
                textAnchor="middle" pointerEvents="none">C{Math.floor(midi / 12) - 1}</text>
            )}
          </g>
        )
      })}

      {/* black keys */}
      {blacks.map(({ midi, x }) => {
        const pc = midi % 12
        const fill = selected.has(pc) ? 'url(#bs)' : scale.has(pc) ? 'url(#bsc)' : 'url(#bn)'
        return (
          <g key={`b${midi}`}>
            <path
              d={bottomRounded(x, 0, bw, bh, 4)} fill={fill}
              stroke="#000" strokeWidth="1"
              onMouseEnter={() => enter(midi)}
              onMouseDown={() => press(midi)}
              style={{ cursor: 'pointer' }}
            />
            {midi === hover && (
              <path d={bottomRounded(x, 0, bw, bh, 4)} fill="#ffffff" opacity="0.18" pointerEvents="none" />
            )}
          </g>
        )
      })}
    </svg>
  )
}
