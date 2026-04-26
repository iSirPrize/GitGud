import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import Home from './Home'
import Practice from './Practice'
import Quiz from './Quiz'
import { db } from './firebase'
import { collection, addDoc } from 'firebase/firestore'
import AimTrainer from './AimTrainer'
import { useState, useEffect } from 'react'
import './App.css'
import AuthPage from './AuthPage'
import { onAuth } from './auth'
import Category from './Category'
import QuizCarousel from './components/QuizCarousel'

function App() {
  const [dbStatus, setDbStatus] = useState('')
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    const unsub = onAuth((u) => setUser(u))
    return () => unsub()
  }, [])

  async function testDB() {
    if(!db)
    {
      return;
    }
    try {
      const docRef = await addDoc(collection(db, "test"), {
        message: "Firestore is working",
        userId: user?.uid,
        timestamp: new Date()
      })
      setDbStatus(`Write successful! Doc ID: ${docRef.id}`)
    } catch (e) {
      setDbStatus(`Error: ${e.message}`)
    }
  }

  // Auth handling
  if (user === undefined) return <div className="loading">Loading page...</div>
  if (!user) return <AuthPage />

  // Logged in
  return (
    <>
      {/* Test button (temporary) */}
      <button onClick={testDB}>Test Firestore</button>
      {dbStatus && <p>{dbStatus}</p>}

      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home user={user} />} />
          <Route path="practice" element={<Practice />} />
          <Route path="practice/aim" element={<AimTrainer />} />
          <Route path="quiz" element={<Category />} />
          <Route path="quiz/:gameId" element={<QuizCarousel />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
