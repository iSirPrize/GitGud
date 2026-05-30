import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import Home from './Home'
import Practice from './Practice'
import AimTrainer from './AimTrainer'
import ReactionTrainer from './ReactionTrainer'
import { useState, useEffect } from 'react'
import './App.css'
import AuthPage from './AuthPage'
import LandingPage from './LandingPage'
import { onAuth } from './auth'
import { initUserDoc } from './usePoints'
import Category from './Category'
import QuizCarousel from './components/QuizCarousel'
import ProfilePage from './ProfilePage'
import UserQuizPage from './UserQuizPage'
import UserQuizCreate from './UserQuizCreate'
import UserQuizCarousel from './UserQuizCarousel'
import AdminPanel from './AdminPanel'
import AdminQuizCreate from './AdminQuizCreate'
import AdminQuizPage from './AdminQuizPage'
import CritiquePage from './CritiquePage'
import CritiqueCreate from './CritiqueCreate'
import { useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import LeaderboardPage from "./LeaderboardPage"
import ChatPage from './ChatPage'
import ChatDashboard from './ChatDashboard'
import DailiesPage from './DailiesPage'   // DAILIES: new page

function App() {
  const [user, setUser] = useState(undefined)
  const [showAuth, setShowAuth] = useState(false)
  const [hasSeenLanding, setHasSeenLanding] = useState(
    () => sessionStorage.getItem('seenLanding') === 'true'
  )
  const authIntentRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = onAuth(async (u) => {
      setUser(u)
      if (u) {
        setShowAuth(false)
        await initUserDoc(u.uid, u.displayName, u.photoURL)
        if (authIntentRef.current === 'register') navigate(`/profile/${u.uid}`)
        else if (authIntentRef.current === 'login') navigate('/')
        authIntentRef.current = null
      }
    })
    return () => unsub()
  }, [])

  const handleGetStarted = () => {
    sessionStorage.setItem('seenLanding', 'true')
    setHasSeenLanding(true)
    setShowAuth(true)
  }

  if (user === undefined) return <div className="loading">Loading page...</div>
  if (!hasSeenLanding) return <LandingPage onLogin={handleGetStarted} />
  if (!user) return showAuth
    ? <AuthPage onIntent={(intent) => { authIntentRef.current = intent }} />
    : <LandingPage onLogin={handleGetStarted} />

  return (
    <Routes>
      <Route path="/" element={<Layout user={user} />}>
        <Route path="profile/:profileId" element={<ProfilePage user={user} />} />
        <Route index element={<Home user={user} />} />
        <Route path="practice" element={<Practice />} />
        <Route path="practice/aim" element={<AimTrainer />} />
        <Route path="practice/reaction" element={<ReactionTrainer />} />

        {/* ── Quiz hub (game selection) ─────────────────────────────────── */}
        <Route path="quiz" element={<Category user={user} />} />

        {/* ── Original hardcoded Valorant demo — PRESERVED ─────────────── */}
        <Route path="quiz/:gameId" element={<QuizCarousel user={user} />} />
        <Route path="quiz/:gameId/:scenarioId" element={<QuizCarousel user={user} />} />
        {/* ── Admin quiz game landing (Play Quiz / Create Quiz) ─────────── */}
        <Route path="admin-quiz/:gameId" element={<AdminQuizPage user={user} />} />

        {/* ── Admin quiz builder ────────────────────────────────────────── */}
        <Route path="admin-quiz/create" element={<AdminQuizCreate user={user} />} />

        {/* ── Leaderboard ───────────────────────────────────────────────── */}
        <Route path="leaderboard" element={<LeaderboardPage currentUid={user.uid} />} />

        {/* ── User quizzes ──────────────────────────────────────────────── */}
        <Route path="user-quiz" element={<UserQuizPage user={user} />} />
        <Route path="user-quiz/create" element={<UserQuizCreate user={user} />} />
        <Route path="user-quiz/play/:gameId" element={<UserQuizCarousel user={user} />} />

        {/* ── Admin moderation panel ────────────────────────────────────── */}
        <Route path="admin" element={<AdminPanel user={user} />} />

        {/* ── Critique ──────────────────────────────────────────────────── */}
        <Route path="critique" element={<CritiquePage user={user} />} />
        <Route path="critique/create" element={<CritiqueCreate user={user} />} />

        {/* ── Messaging ─────────────────────────────────────────────────── */}
        <Route path="messages" element={<ChatDashboard user={user} />} />
        <Route path="messages/:chatId" element={<ChatPage user={user} />} />
        <Route path="dailies" element={<DailiesPage user={user} />} />
      </Route>
    </Routes>
  )
}

export default App
