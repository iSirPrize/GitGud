/**
 * Layout.jsx — UPDATED VERSION
 *
 * Changes from original:
 *  1. Added SkillTreeIndicator import
 *  2. Added /skill-tree NavLink with red ! badge
 *
 * Place at: gitgud-client/src/Layout.jsx
 * (replaces existing Layout.jsx entirely)
 */

import { Outlet, NavLink, useNavigate } from "react-router-dom"
import DarkModeToggle from "./components/DarkModeToggle"
import ProfileDropdown from "./ProfileDropdown"
import "./NavBar.css"
import { useTheme } from './context/ThemeContext'
import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "./firebase"
import FavouriteButton from "./components/FavouriteButton"
import NotificationBell from "./NotficationBell"
import SkillTreeIndicator from "./components/SkillTreeIndicator"   // ← NEW


function Layout({ user }) {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const SIDEBAR_OPEN_WIDTH   = 170
  const SIDEBAR_CLOSED_WIDTH = 40

  useEffect(() => {
    if (!user?.uid) { setIsAdmin(false); return; }
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists() && snap.data().isAdmin === true) setIsAdmin(true)
    }).catch(() => {})
  }, [user?.uid])

  const sidebarWidth  = open ? SIDEBAR_OPEN_WIDTH : SIDEBAR_CLOSED_WIDTH
  const contentOffset = sidebarWidth

  return (
    <div className={`quiz-carousel ${theme?.toLowerCase?.()}`}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div
        className={`sidebar ${open ? "open" : ""}`}
        style={{ width: sidebarWidth }}
      >
        <button className="sidebar-toggle" onClick={() => setOpen(!open)}>
          <span className="arrow">{open ? "◀" : "☰"}</span>
        </button>

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

          {/* ── NEW: Skill Tree link with pending indicator ────────────── */}
          <NavLink to="/skill-tree" className={({ isActive }) => isActive ? "practice active" : "practice"}>
            <div className="nav-main" style={{ display: 'flex', alignItems: 'center' }}>
              Skill Tree
              <SkillTreeIndicator uid={user?.uid} />
            </div>
            <div className="nav-desc">Unlock Powerful Perks!</div>
          </NavLink>

          <NavLink to="/dailies" className={({ isActive }) => isActive ? "practice active" : "practice"}>
            <div className="nav-main">Dailies</div>
            <div className="nav-desc">Your Daily Quests!</div>
          </NavLink>

          <NavLink to="/rewards" className={({ isActive }) => isActive ? "practice active" : "practice"}>
            <div className="nav-main">Rewards</div>
            <div className="nav-desc">Unlock Achievements &amp; Cosmetics!</div>
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
      <section
        id="center"
        className={theme}
        style={{
          marginLeft: contentOffset,
          transition: "margin-left 0.3s ease",
        }}
      >
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 10, zIndex: 100 }}>
          <NotificationBell user={user} />
          <FavouriteButton onClick={() => navigate(`/profile/${user?.uid || "me"}?tab=favourites`)} />
          <DarkModeToggle />
          <ProfileDropdown user={user} />
        </div>
        <Outlet />
      </section>
    </div>
  )
}

export default Layout
