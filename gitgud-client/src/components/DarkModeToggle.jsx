import { useTheme } from "../context/ThemeContext"

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

export default function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === "dark"
  const accent = dark ? "#ff6a00" : "#0066cc"
  const bg     = dark ? "rgba(255,106,0,0.1)" : "rgba(0,102,204,0.08)"
  const border = dark ? "rgba(255,106,0,0.3)" : "rgba(0,102,204,0.25)"

  return (
    <button
      onClick={toggleTheme}
      title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      style={{ display:'flex', alignItems:'center', justifyContent:'center',
        width:36, height:36, borderRadius:'50%', border:`1.5px solid ${border}`,
        background:bg, color:accent, cursor:'pointer',
        transition:'all 0.2s ease' }}
      onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,106,0,0.2)' : 'rgba(0,102,204,0.15)'; e.currentTarget.style.borderColor = accent }}
      onMouseLeave={e => { e.currentTarget.style.background = bg; e.currentTarget.style.borderColor = border }}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
