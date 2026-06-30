import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Nav from './components/Nav'
import VoicerPage from './pages/Voicer'
import ScaleFinderPage from './pages/ScaleFinder'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <HashRouter>
      <Nav />
      <ErrorBoundary>
        <Routes>
          <Route path="/voicer" element={<VoicerPage />} />
          <Route path="/scale-finder" element={<ScaleFinderPage />} />
          <Route path="*" element={<Navigate to="/voicer" replace />} />
        </Routes>
      </ErrorBoundary>
    </HashRouter>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
