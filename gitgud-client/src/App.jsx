import { useState } from 'react'
import './App.css'
import DarkModeToggle from './components/DarkModeToggle'   // ← Dark Mode
import QuizCarousel from './components/QuizCarousel'      // Quiz Carousel (Window and panel)
import PicUpload from './PicUpload'                       // Profile picture upload

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="center">
        {/* 🌙 Dark Mode Toggle - TOP RIGHT */}
        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
          <DarkModeToggle />
        </div>
        <PicUpload />
      </section>

      <div className="ticks"></div>

      {/* 🎮 Quiz Carousel - YouTube window + multi-choice panel */}
      <QuizCarousel />

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
