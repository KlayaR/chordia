/**
 * Platform bridge. In the Tauri desktop build we get real filesystem access
 * and an OS-level drag (so files land in a DAW). In the browser these are
 * no-ops / fall back to web behaviour.
 *
 * Tauri modules are PRELOADED (not imported on demand) the moment this module
 * evaluates in a desktop context, so the drag has zero chunk-load latency when
 * the user grabs the handle — Windows needs startDrag called promptly while the
 * mouse is down or it misses the gesture.
 */

export function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

let _invoke = null
let _startDrag = null
let _ready = null

if (isTauri()) {
  _ready = Promise.all([
    import('@tauri-apps/api/core').then((m) => { _invoke = m.invoke }),
    import('@crabnebula/tauri-plugin-drag').then((m) => { _startDrag = m.startDrag }),
  ]).catch((e) => console.error('Tauri module preload failed:', e))
}

// Write bytes to a temp file; resolves to { file, icon } real paths.
export async function writeTempMidi(filename, uint8) {
  if (_ready) await _ready
  if (!_invoke) throw new Error('Tauri invoke unavailable')
  return _invoke('save_drag_file', { filename, bytes: Array.from(uint8) })
}

// Start an OS drag of a real file. onEvent gets { result: "Dropped"|"Cancelled" }.
export async function dragFile(file, icon, onEvent) {
  if (_ready) await _ready
  if (!_startDrag) throw new Error('drag plugin unavailable')
  return _startDrag({ item: [file], icon, mode: 'copy' }, onEvent)
}
