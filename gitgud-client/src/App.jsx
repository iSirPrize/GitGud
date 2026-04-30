import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import Home from './Home'
import Practice from './Practice'
import AimTrainer from './AimTrainer'
import { useState, useEffect } from 'react'
import './App.css'
import AuthPage from './AuthPage'
import LandingPage from './LandingPage'
import { onAuth } from './auth'
import { initUserDoc } from './usePoints'
import Category from './Category'
import QuizCarousel from './components/QuizCarousel'
import Leaderboard from './Leaderboard'
import ProfilePage from './ProfilePage'
import { useNavigate } from 'react-router-dom'
import { useRef } from 'react'

function App() {
  const [user, setUser] = useState(undefined)
  const [showAuth, setShowAuth] = useState(false)
  const [hasSeenLanding, setHasSeenLanding] = useState(
    () => sessionStorage.getItem('seenLanding') === 'true'
  )
  const authIntentRef = useRef(null)        // 'login' | 'register'
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
        <Route path="quiz" element={<Category />} />
        <Route path="quiz/:gameId" element={<QuizCarousel user={user} />} />
        <Route path="leaderboard" element={<Leaderboard currentUid={user.uid} />} />
      </Route>
    </Routes>
  )
}

export default App
