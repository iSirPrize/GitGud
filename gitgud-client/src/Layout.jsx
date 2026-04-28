import { Outlet, NavLink } from "react-router-dom"
import DarkModeToggle from "./components/DarkModeToggle"
import ProfileDropdown from "./ProfileDropdown"
import "./NavBar.css"
import { useTheme } from './context/ThemeContext'

function Layout({ user }) {
  const { theme } = useTheme()
  return (
    <div className={`quiz-carousel ${theme?.toLowerCase?.()}`}>
      <div className="sidebar">
        <div className="sidebar-content">
          <NavLink to="/" className={({ isActive }) => isActive ? "practice active" : "practice"}>Home</NavLink>
          <NavLink to="/practice" className={({ isActive }) => isActive ? "practice active" : "practice"}>Practice</NavLink>
          <NavLink to="/quiz" className={({ isActive }) => isActive ? "practice active" : "practice"}>Quiz</NavLink>
          <NavLink to="/leaderboard" className={({ isActive }) => isActive ? "practice active" : "practice"}>Leaderboard</NavLink>
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
