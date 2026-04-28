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

function App() {
  const [user, setUser] = useState(undefined)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    const unsub = onAuth(async (u) => {
      setUser(u)
      if (u) { setShowAuth(false); await initUserDoc(u.uid, u.displayName, u.photoURL) }
    })
    return () => unsub()
  }, [])

  if (user === undefined) return <div className="loading">Loading page...</div>
  if (!user) return showAuth ? <AuthPage /> : <LandingPage onLogin={() => setShowAuth(true)} />

  return (
    <Routes>
      <Route path="/" element={<Layout user={user} />}>
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
