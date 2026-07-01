/**
 * Smooth piano voice leading for a sequence of chord events.
 *
 * The right hand holds any common tone on the SAME note between chords and moves
 * every other voice to the nearest available chord tone — so changing chords is
 * a small finger shift, not a whole-hand jump. The left hand plays the root low.
 * Mutates each event, adding `.notes` (MIDI) and `.rh` / `.bass`.
 */

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const pcOf = (m) => ((m % 12) + 12) % 12

function smoothVoicing(pcs, prev, lo, hi) {
  const home = (lo + hi) / 2                                  // register anchor
  const center = prev && prev.length ? mean(prev) : home
  const out = []
  for (const pc of pcs) {
    const common = prev && prev.find((m) => pcOf(m) === pc)   // retain common tone
    if (common != null && !out.includes(common)) { out.push(common); continue }
    let best = null, bd = Infinity
    for (let m = lo; m <= hi; m++) {
      if (pcOf(m) !== pc) continue
      const d = Math.abs(m - center)
      if (d < bd) { bd = d; best = m }
    }
    out.push(best ?? 60 + pc)
  }
  let v = [...new Set(out)].sort((a, b) => a - b)
  // anti-drift: when a chord shares no common tone it can ratchet up/down over a
  // loop — pull the whole voicing back into the home register (± a 5th).
  let m = mean(v)
  while (m > home + 7 && Math.min(...v) - 12 >= lo) { v = v.map((x) => x - 12); m -= 12 }
  while (m < home - 7 && Math.max(...v) + 12 <= hi) { v = v.map((x) => x + 12); m += 12 }
  return v
}

export function voiceLeadEvents(events, { rhLow = 55, rhHigh = 81, bassLow = 40 } = {}) {
  let prev = null
  let prevBass = null
  for (const ev of events) {
    const c = ev.chord
    const pcs = [...new Set(c.intervals.map((iv) => (c.root + iv) % 12))]
    const rh = smoothVoicing(pcs, prev, rhLow, rhHigh)
    // bass = root (or tonic pedal, if the event sets bassPc) in the low register,
    // nearest to the previous bass for a smooth line
    const bassPc = ev.bassPc != null ? ev.bassPc : c.root
    let bass = bassLow + (((bassPc - bassLow) % 12) + 12) % 12
    if (prevBass !== null && Math.abs(bass - 12 - prevBass) < Math.abs(bass - prevBass) && bass - 12 >= bassLow - 6) bass -= 12
    ev.rh = rh
    ev.bass = bass
    ev.notes = [bass, ...rh]
    prev = rh
    prevBass = bass
  }
  return events
}

// average semitone movement of the right hand between consecutive chords —
// a smoothness metric (lower = smoother voice leading)
export function handMovement(events) {
  let total = 0, n = 0
  for (let i = 1; i < events.length; i++) {
    const a = events[i - 1].rh, b = events[i].rh
    if (!a || !b) continue
    const k = Math.min(a.length, b.length)
    for (let j = 0; j < k; j++) total += Math.abs(b[j] - a[j])
    n += k
  }
  return n ? total / n : 0
}
