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
import { onAuth, auth } from './auth'
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
import DailiesPage from './DailiesPage'
import RewardPage from './RewardPage'
import SkillTreePage from './SkillTreePage'

function App() {
  const [user, setUser] = useState(undefined)
  const [showAuth, setShowAuth] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState(null)
  const [hasSeenLanding, setHasSeenLanding] = useState(
    () => sessionStorage.getItem('seenLanding') === 'true'
  )
  const authIntentRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = onAuth(async (u) => {
      // Block unverified email/password accounts.
      // Google sign-in users always have emailVerified: true so they're unaffected.
      // Existing accounts that already verified are also unaffected.
      if (u && !u.emailVerified) {
        setUnverifiedEmail(u.email)
        setUser(null)
        await auth.signOut()
        return
      }

      setUser(u)
      setUnverifiedEmail(null)

      if (u) {
        setShowAuth(false)
        // initUserDoc now receives email so it can store it on the user document.
        // { merge: true } inside initUserDoc means existing accounts are safe.
        await initUserDoc(u.uid, u.displayName, u.photoURL, u.email)
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
    ? <AuthPage
        onIntent={(intent) => { authIntentRef.current = intent }}
        unverifiedEmail={unverifiedEmail}
      />
    : <LandingPage onLogin={handleGetStarted} />

  return (
    <Routes>
      <Route path="/" element={<Layout user={user} />}>
        <Route path="profile/:profileId" element={<ProfilePage user={user} />} />
        <Route index element={<Home user={user} />} />
        <Route path="practice" element={<Practice />} />
        <Route path="practice/aim" element={<AimTrainer />} />
        <Route path="practice/reaction" element={<ReactionTrainer />} />
        <Route path="quiz" element={<Category user={user} />} />
        <Route path="quiz/:gameId" element={<QuizCarousel user={user} />} />
        <Route path="quiz/:gameId/:scenarioId" element={<QuizCarousel user={user} />} />
        <Route path="admin-quiz/:gameId" element={<AdminQuizPage user={user} />} />
        <Route path="admin-quiz/create" element={<AdminQuizCreate user={user} />} />
        <Route path="rewards" element={<RewardPage user={user} />} />
        <Route path="leaderboard" element={<LeaderboardPage currentUid={user.uid} />} />
        <Route path="user-quiz" element={<UserQuizPage user={user} />} />
        <Route path="user-quiz/create" element={<UserQuizCreate user={user} />} />
        <Route path="user-quiz/play/:gameId/:quizId?" element={<UserQuizCarousel user={user} />} />
        <Route path="admin" element={<AdminPanel user={user} />} />
        <Route path="critique" element={<CritiquePage user={user} />} />
        <Route path="critique/create" element={<CritiqueCreate user={user} />} />
        <Route path="messages" element={<ChatDashboard user={user} />} />
        <Route path="messages/:chatId" element={<ChatPage user={user} />} />
        <Route path="dailies" element={<DailiesPage user={user} />} />
        <Route path="skill-tree" element={<SkillTreePage user={user} />} />
      </Route>
    </Routes>
  )
}
export default App
