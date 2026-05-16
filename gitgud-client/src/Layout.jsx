import { Outlet, NavLink, useNavigate } from "react-router-dom"
import DarkModeToggle from "./components/DarkModeToggle"
import ProfileDropdown from "./ProfileDropdown"
import "./NavBar.css"
import { useTheme } from './context/ThemeContext'
import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "./firebase"


function Layout({ user }) {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Sidebar width constants.
  // Reverted to original 200px open width, then shifted content right by 10px
  // (210px total) so the "B" in "Browse by Game" clears the sidebar edge.
  // SIDEBAR_CLOSED_WIDTH stays at 40px (original).
  const SIDEBAR_OPEN_WIDTH   = 170
  const SIDEBAR_CLOSED_WIDTH = 40

  useEffect(() => {
    if (!user?.uid)
    {
      setIsAdmin(false);
      return;
    }
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists() && snap.data().isAdmin === true) setIsAdmin(true)
    }).catch(() => {})
  }, [user?.uid])

  // GGG_MAS pattern: content panel's left offset = sidebar width.
  // When sidebar toggles, main content repositions immediately so it
  // never sits under or clips behind the sidebar.
  const sidebarWidth  = open ? SIDEBAR_OPEN_WIDTH : SIDEBAR_CLOSED_WIDTH
  const contentOffset = sidebarWidth

  return (
    <div className={`quiz-carousel ${theme?.toLowerCase?.()}`}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div
        className={`sidebar ${open ? "open" : ""}`}
        style={{ width: sidebarWidth }}
      >
        {/* Toggle button */}
        <button
          className="sidebar-toggle"
          onClick={() => setOpen(!open)}
        >
          <span className="arrow">{open ? "◀" : "☰"}</span>
        </button>

        {/* Logo — only visible when open */}
        <div className="sidebar-logo">
          <NavLink to="/" className="sidebar-logo-link">
            <img
              src={theme === "dark"
                ? "/GitGud-dark.png"
                : "/GitGud-logo-transparent.png"}
              alt="Logo"
            />
          </NavLink>
        </div>

        {/* Nav links */}
        <div className="sidebar-content">
          <NavLink to="/" className={({ isActive }) => isActive ? "practice active" : "practice"}>
            <div className="nav-main">Home</div>
            <div className="nav-desc">Back to Main Menu!</div>
          </NavLink>

          <NavLink 
            to={user?.uid ? `/profile/${user.uid}` : "/"} 
            className={({ isActive }) => isActive ? "practice active" : "practice"}
          >
            <div className="nav-main">Profile</div>
            <div className="nav-desc">View Your Stats!</div>
          </NavLink>

          <NavLink to="/messages" className={({ isActive }) => isActive ? "practice active" : "practice"}>
            <div className="nav-main">Messages</div>
            <div className="nav-desc">Your Direct Chats & Inbox!</div>
          </NavLink>

          <NavLink to="/practice" className={({ isActive }) => isActive ? "practice active" : "practice"}>
            <div className="nav-main">Practice</div>
            <div className="nav-desc">Improve Your Accuracy &amp; Reaction!</div>
          </NavLink>

          <NavLink to="/quiz" className={({ isActive }) => isActive ? "practice active" : "practice"}>
            <div className="nav-main">Quiz</div>
            <div className="nav-desc">Test Your Game Sense &amp; Knowledge!</div>
          </NavLink>

          <NavLink to="/leaderboard" className={({ isActive }) => isActive ? "practice active" : "practice"}>
            <div className="nav-main">Leaderboard</div>
            <div className="nav-desc">Check Your Rankings!</div>
          </NavLink>

          <NavLink to="/user-quiz" className={({ isActive }) => isActive ? "practice active" : "practice"}>
            <div className="nav-main">User Quizzes</div>
            <div className="nav-desc">Community Clips &amp; Plays!</div>
          </NavLink>

          <NavLink to="/critique" className={({ isActive }) => isActive ? "practice active" : "practice"}>
            <div className="nav-main">User Critique</div>
            <div className="nav-desc">Post Your Clips for Feedback!</div>
          </NavLink>

          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? "practice active" : "practice"}>
              <div className="nav-main">Admin</div>
              <div className="nav-desc">Moderate Quiz Submissions</div>
            </NavLink>
          )}
        </div>
      </div>

      {/* ── Main content area ────────────────────────────────────────────── */}
      {/*
        GGG_MAS pattern translated to CSS:
          C#:  _pnlMain.Location = new Point(sidebarWidth, 0)
          JS:  marginLeft = sidebarWidth (inline style, updates on toggle)
        The transition matches the sidebar animation so they slide together.
      */}
      <section
        id="center"
        className={theme}
        style={{
          marginLeft: contentOffset,
          transition: "margin-left 0.3s ease",
        }}
      >
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 10, zIndex: 100 }}>
          <DarkModeToggle />
          <ProfileDropdown user={user} />
        </div>
        <Outlet />
      </section>
    </div>
  )
}

export default Layout
