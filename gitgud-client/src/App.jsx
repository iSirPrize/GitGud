import { useState } from 'react'
import './App.css'
import Practice from './Practice'
import DarkModeToggle from './components/DarkModeToggle'   // ← Dark Mode
import QuizCarousel from './components/QuizCarousel'      // Quiz Carousel (Window and panel)
import PicUpload from './PicUpload'                       // Profile picture upload

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
            <div>
              <h1>Get started</h1>
              <p>Welcome to GitGud 🚀</p>
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

      <PicUpload />

      <div className="ticks"></div>

      <QuizCarousel />

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
