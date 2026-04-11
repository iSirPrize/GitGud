// App.jsx — Firebase-safe version
import { useState } from 'react'
import './App.css'
import DarkModeToggle from './components/DarkModeToggle'
import QuizCarousel from './components/QuizCarousel'
import PicUpload from './PicUpload'

// ✅ Safely import Firebase — errors won't crash the module
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

// ✅ testDB now lives INSIDE the component so React controls it
function App() {
  const [count, setCount] = useState(0)
  const [dbStatus, setDbStatus] = useState('')

  async function testDB() {
  console.log("db instance:", db)
  try {
    const docRef = await addDoc(collection(db, "test"), {
      message: "Firestore is working",
      timestamp: new Date()
    })
    console.log("Document written with ID:", docRef.id)  // ← if this logs, write succeeded
    setDbStatus(`Write successful! Doc ID: ${docRef.id}`)
  } catch (e) {
    console.error("Full error:", e)
    setDbStatus(`Error: ${e.message}`)
  }
}

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
          {/* ✅ Show result on screen, not just console */}
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