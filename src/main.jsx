import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Nav from './components/Nav'
import VoicerPage from './pages/Voicer'

function App() {
  return (
    <HashRouter>
      <Nav />
      <Routes>
        <Route path="/voicer" element={<VoicerPage />} />
        <Route path="*" element={<Navigate to="/voicer" replace />} />
      </Routes>
    </HashRouter>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
