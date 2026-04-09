import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import DarkModeToggle from './components/DarkModeToggle'   // ← ADD THIS for Dark Mode
import PicUpload from './PicUpload'

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
    </>
  )
}

export default App
