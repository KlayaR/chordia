/**
 * Platform bridge. In the Tauri desktop build we get real filesystem access
 * and an OS-level drag (so files land in a DAW). In the browser these are
 * no-ops / fall back to web behaviour. Tauri modules are loaded lazily so the
 * web bundle never evaluates them.
 */

export function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Write bytes to a temp file and get back { file, icon } real paths.
export async function writeTempMidi(filename, uint8) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('save_drag_file', { filename, bytes: Array.from(uint8) })
}

// Start an OS drag of a real file (drops into Cubase etc.).
export async function dragFile(file, icon) {
  const { startDrag } = await import('@crabnebula/tauri-plugin-drag')
  await startDrag({ item: [file], icon, mode: 'copy' })
}
