import { Outlet, NavLink } from "react-router-dom"
import DarkModeToggle from "./components/DarkModeToggle"
import ProfileDropdown from "./ProfileDropdown"
import "./NavBar.css"
import { useTheme } from './context/ThemeContext'
import { useState } from "react"


function Layout({ user }) {
  const { theme } = useTheme()
  const [open, setOpen] = useState(true)

  return (
    <div className={`quiz-carousel ${theme?.toLowerCase?.()}`}>
      <div className={`sidebar ${open ? "open" : ""}`}>

         {/* Toggle button */}
        <button 
          className="sidebar-toggle"
          onClick={() => setOpen(!open)}
        >
          <span className="arrow">{open ? "◀" : "☰"}</span>
        </button>

        <div className="sidebar-logo" onClick={() => navigate("/")}>
  <NavLink to="/" className="sidebar-logo">
  <img 
    src={theme === "dark" 
      ? "/GitGud-dark.png"
      : "/GitGud-logo-transparent.png"} 
    alt="Logo"
  />
</NavLink>
</div>

        <div className="sidebar-content">
          <NavLink to="/" className={({ isActive }) => isActive ? "practice active" : "practice"}>
  <div className="nav-main">Home</div>
  <div className="nav-desc">Back to Main Menu!</div>
</NavLink>

<NavLink to={`/profile/${user.uid}`} className={({ isActive }) => isActive ? "practice active" : "practice"}>
  <div className="nav-main">Profile</div>
  <div className="nav-desc">View Your Stats!</div>
</NavLink>

<NavLink to="/practice" className={({ isActive }) => isActive ? "practice active" : "practice"}>
  <div className="nav-main">Practice</div>
  <div className="nav-desc">Improve Your Accuracy & Reaction!</div>
</NavLink>

<NavLink to="/quiz" className={({ isActive }) => isActive ? "practice active" : "practice"}>
  <div className="nav-main">Quiz</div>
  <div className="nav-desc">Test Your Game Sense & Knowledge!</div>
</NavLink>

<NavLink to="/leaderboard" className={({ isActive }) => isActive ? "practice active" : "practice"}>
  <div className="nav-main">Leaderboard</div>
  <div className="nav-desc">Check Your Rankings!</div>
</NavLink>
        </div>
      </div>
      <section id="center" className={theme}>
        <div style={{ position:'absolute', top:16, right:16, display:'flex', alignItems:'center', gap:10, zIndex:100 }}>
          <DarkModeToggle />
          <ProfileDropdown user={user} />
        </div>
        <Outlet />
      </section>
    </div>
  )
}

export default Layout
