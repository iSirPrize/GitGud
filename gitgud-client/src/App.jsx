import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import Home from './Home'
import Practice from './Practice'
import Quiz from './Quiz'
import AimTrainer from './AimTrainer'

import { useState, useEffect } from 'react'
import './App.css'
import AuthPage from './AuthPage'
import { onAuth } from './auth'

let db = null
let collection = null
let addDoc = null

try {
  const fb = await import('./firebase')
  db = fb.db
  const fs = await import('firebase/firestore')
  collection = fs.collection
  addDoc = fs.addDoc
} catch (e) {
  console.error('Firebase init failed:', e)
}

function App() {
  const [dbStatus, setDbStatus] = useState('')
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    const unsub = onAuth((u) => setUser(u))
    return () => unsub()
  }, [])

  async function testDB() {
    try {
      const docRef = await addDoc(collection(db, "test"), {
        message: "Firestore is working",
        timestamp: new Date()
      })
      setDbStatus(`Write successful! Doc ID: ${docRef.id}`)
    } catch (e) {
      setDbStatus(`Error: ${e.message}`)
    }
  }

  // Auth handling
  if (user === undefined) return null
  if (!user) return <AuthPage onAuthed={() => {}} />

  // Logged in
  return (
    <>
      {/* Test button (temporary) */}
      <button onClick={testDB}>Test Firestore</button>
      {dbStatus && <p>{dbStatus}</p>}

      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="practice" element={<Practice />} />
          <Route path="practice/aim" element={<AimTrainer />} />
          <Route path="quiz" element={<Quiz />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
