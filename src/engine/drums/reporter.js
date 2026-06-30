/**
 * Change report — the rules engine logs every modification here; the UI renders
 * the summary. Ported from MidiHuman's Reporter.
 */
export function makeReporter(profileName = '', unmappedNotes = []) {
  return {
    entries: [],
    counters: {},
    notesProcessed: 0,
    bars: 0,
    elapsedS: 0,
    unmappedNotes,
    profileName,
    timingCount: 0,
    timingDevTotal: 0,

    log(rule, description, bar, beat, { countKey = null, count = 1 } = {}) {
      this.entries.push({ bar: Math.trunc(bar), beat: Math.round(beat * 100) / 100, rule, description })
      const key = countKey || rule
      this.counters[key] = (this.counters[key] || 0) + count
    },
    bump(key, count = 1) { this.counters[key] = (this.counters[key] || 0) + count },
    addTiming(devMs) { this.timingCount += 1; this.timingDevTotal += Math.abs(devMs) },

    timingStats() {
      if (!this.timingCount) return [0, 0]
      return [this.timingCount, this.timingDevTotal / this.timingCount]
    },

    summaryLines() {
      const [nTiming, avgDev] = this.timingStats()
      const lines = [
        `✓ Processed ${this.notesProcessed.toLocaleString()} notes across ${this.bars} bars`,
      ]
      const add = (key, singular, plural) => {
        const c = this.counters[key]
        if (c) lines.push(`  → ${c} ${c === 1 ? singular : plural}`)
      }
      add('Voicing', 'note voiced to target', 'notes voiced to targets')
      if (nTiming) lines.push(`  → ${nTiming} timing adjustment${nTiming === 1 ? '' : 's'} (avg ±${avgDev.toFixed(1)}ms)`)
      add('Double kick', 'double-kick run shaped', 'double-kick runs shaped')
      add('Fill', 'fill detected and shaped', 'fills detected and shaped')
      add('Tom hands', 'tom hand-alternation hit', 'tom hand-alternation hits')
      add('Ghost note', 'ghost note voiced', 'ghost notes voiced')
      add('Ruff', 'ruff/grace note voiced', 'ruff/grace notes voiced')
      add('Crash', 'impact crash voiced', 'impact crashes voiced')
      add('Build-up', 'pre-impact breath', 'pre-impact breaths')
      add('Limb conflict', 'limb conflict resolved', 'limb conflicts resolved')
      if (this.unmappedNotes.length) {
        lines.push(`  ⚠ ${this.unmappedNotes.length} unmapped note(s) left untouched: ${this.unmappedNotes.join(', ')}`)
      }
      return lines
    },
  }
}
