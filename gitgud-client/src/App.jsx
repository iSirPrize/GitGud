// App.jsx — Firebase-safe version with auth gate
import { useState, useEffect } from 'react'
import './App.css'
import DarkModeToggle from './components/DarkModeToggle'
import QuizCarousel from './components/QuizCarousel'
import PicUpload from './PicUpload'
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
  const [count, setCount] = useState(0)
  const [dbStatus, setDbStatus] = useState('')
  const [user, setUser] = useState(undefined) // undefined = loading, null = logged out

  useEffect(() => {
    const unsub = onAuth((u) => setUser(u))
    return () => unsub()
  }, [])

  async function testDB() {
    console.log("db instance:", db)
    try {
      const docRef = await addDoc(collection(db, "test"), {
        message: "Firestore is working",
        timestamp: new Date()
      })
      console.log("Document written with ID:", docRef.id)
      setDbStatus(`Write successful! Doc ID: ${docRef.id}`)
    } catch (e) {
      console.error("Full error:", e)
      setDbStatus(`Error: ${e.message}`)
    }
  }

  // Still checking auth state
  if (user === undefined) return null

  // Not logged in — show auth page
  if (!user) return <AuthPage onAuthed={() => {}} />

  // Logged in — show the app
  return (
    <>
      <section id="center">
        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
          <DarkModeToggle />
        </div>
        <PicUpload />
      </section>
      <section>
        <div>
          <button onClick={testDB}>Test Firestore</button>
          {dbStatus && <p style={{ marginTop: '8px' }}>{dbStatus}</p>}
        </div>
      </section>
      <div className="ticks"></div>
      <QuizCarousel />
      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
