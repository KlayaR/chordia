import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const host = process.env.TAURI_DEV_HOST

// Tauri sets TAURI_ENV_* when it invokes the before-dev/build command.
// Desktop (Tauri) loads assets over a custom protocol → relative base.
// Web (GitHub Pages) is served from /chordia/.
const isTauri = !!process.env.TAURI_ENV_PLATFORM

export default defineConfig({
  plugins: [react()],
  base: isTauri ? './' : '/chordia/',

  // Tauri-friendly dev server
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
})
