import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import DarkModeToggle from './components/DarkModeToggle'   // ← ADD THIS for Dark Mode
import Practice from './Practice'

function App() {
  const [page, setPage] = useState("home")
  const [count, setCount] = useState(0)

  return (
    <>
    {/* adding the practice button here */}
      <div className="sidebar">
        <div className="sidebar-content">
          <button className="practice"
          onClick={() => setPage("home")}>
            Home
          </button>
          <button className="practice"
          onClick={() => setPage("practice")}>
            Practice
          </button>
        </div>
      </div>
      <section id="center">
        {/* 🌙 Dark Mode Toggle - TOP RIGHT */}
        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
          <DarkModeToggle />
        </div>
        {/*makeshift home page */}
        {page == "home" && (
        <>
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
          </p>
        </div>
          <button
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
        </>
        )}

        {/* PRACTICE PAGE */}
        {page === "practice" && <Practice setPage={setPage} />}
      </section>
    </>
  )
}

export default App
