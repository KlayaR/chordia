import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Nav from './components/Nav'
import ErrorBoundary from './components/ErrorBoundary'

// Route-based code splitting — each tool (and its heavy deps like Tone.js /
// @tonejs/midi) loads only when its tab is opened.
const VoicerPage = lazy(() => import('./pages/Voicer'))
const ScaleFinderPage = lazy(() => import('./pages/ScaleFinder'))
const HumanizerPage = lazy(() => import('./pages/Humanizer'))
const PianoHumanizerPage = lazy(() => import('./pages/PianoHumanizer'))
const SongBuilderPage = lazy(() => import('./pages/SongBuilder'))

const Loading = () => <div style={{ padding: '3rem', textAlign: 'center', color: '#6a6f7c' }}>Loading…</div>

function App() {
  return (
    <HashRouter>
      <Nav />
      <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/voicer" element={<VoicerPage />} />
            <Route path="/scale-finder" element={<ScaleFinderPage />} />
            <Route path="/humanizer" element={<HumanizerPage />} />
            <Route path="/piano-humanizer" element={<PianoHumanizerPage />} />
            <Route path="/song-builder" element={<SongBuilderPage />} />
            <Route path="*" element={<Navigate to="/voicer" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
