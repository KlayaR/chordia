import { NavLink } from 'react-router-dom'
import './Nav.css'

const TOOLS = [
  { to: '/voicer', label: 'Voicer' },
  { to: '/scale-finder', label: 'Scale Finder' },
  { to: '/humanizer', label: 'Drum Humanizer' },
  { to: '/piano-humanizer', label: 'Piano Humanizer' },
  // { to: '/song-builder', label: 'Song Builder' },  // coming soon
]

export default function Nav() {
  return (
    <nav className="nav">
      <span className="nav-brand">Chordia</span>
      <div className="nav-links">
        {TOOLS.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
