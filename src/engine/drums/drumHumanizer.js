/**
 * Top-level drum humanization (ported from MidiHuman). Clones the parsed notes
 * so the same parse can be re-humanized with different slider values.
 */
import { makeReporter } from './reporter.js'
import { runAll } from './drumRules.js'
import { parseDrums, buildOutput } from './drumParser.js'
import { DRUM_MAPS, DEFAULT_MAP } from './drumMaps.js'
import { makeRng } from './rng.js'
import { PROFILE_NAME } from './nollyProfile.js'

export function humanize(parse, drumMap, { velocityIntensity = 100, timingIntensity = 75, feel = 0, seed } = {}) {
  const rng = makeRng(seed)
  const notes = parse.notes.map((n) => ({ ...n }))   // work on a clone
  const originalNotes = parse.notes.map((n) => ({ ...n }))

  const reporter = makeReporter(PROFILE_NAME, [...parse.unmappedNotes])
  reporter.notesProcessed = notes.length
  reporter.bars = parse.totalBars

  if ((velocityIntensity > 0 || timingIntensity > 0) && notes.length) {
    const ctx = {
      notes, drumMap,
      velIntensity: velocityIntensity / 100,
      timeIntensity: timingIntensity / 100,
      feel: Math.max(-100, Math.min(100, feel)) / 100,
      tempoMap: parse.tempoMap, tsMap: parse.tsMap, ppq: parse.ppq,
      reporter, rng, totalBars: parse.totalBars, doublePedal: false,
    }
    runAll(ctx)
  }
  return { parse, notes, originalNotes, reporter, drumMap, velocityIntensity, timingIntensity, feel }
}

export async function humanizeFile(file, mapName = DEFAULT_MAP, opts = {}) {
  const drumMap = DRUM_MAPS[mapName] || DRUM_MAPS[DEFAULT_MAP]
  const parse = await parseDrums(file, drumMap, opts.trackIndex ?? null)
  return humanize(parse, drumMap, opts)
}

export function exportResult(result) {
  return buildOutput(result.parse, result.notes)
}
