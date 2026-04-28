import { useEffect, useState } from "react"
import DarkModeToggle from "./components/DarkModeToggle"
import { useTheme } from "./context/ThemeContext"

export default function LandingPage({ onLogin }) {
  const [vis, setVis] = useState(false)
  const { theme } = useTheme()
  const dark = theme === "dark"

  useEffect(() => { const t = setTimeout(() => setVis(true), 100); return () => clearTimeout(t) }, [])

  const accent     = dark ? "#ff6a00" : "#0066cc"
  const accentGlow = dark ? "rgba(255,106,0,0.35)" : "rgba(0,102,204,0.2)"
  const bg         = dark ? "#0d0d0d" : "#f4f4f4"
  const surface    = dark ? "#181818" : "#ffffff"
  const text       = dark ? "#f0f0f0" : "#111111"
  const subtext    = dark ? "#999"    : "#666"
  const border     = dark ? "rgba(255,106,0,0.25)" : "rgba(0,102,204,0.2)"

  const features = [
    { title: "Watch Clips",    desc: "Browse real gameplay moments submitted by the community." },
    { title: "Vote Smart",     desc: "Judge plays and earn 10 points for every correct call." },
    { title: "Level Up",       desc: "Hit 100 points to level up. Climb the global leaderboard." },
    { title: "Upload & Teach", desc: "Share your own clips and let the community learn from you." },
  ]

  return (
    <div style={{ fontFamily:"'Segoe UI','Helvetica Neue',sans-serif", background: bg, color: text }}>

      <div style={{ position:'fixed', top:16, right:16, zIndex:200 }}>
        <DarkModeToggle />
      </div>

      {/* Hero */}
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0,
          backgroundImage:`linear-gradient(${dark?'rgba(255,106,0,0.04)':'rgba(0,102,204,0.05)'} 1px,transparent 1px),linear-gradient(90deg,${dark?'rgba(255,106,0,0.04)':'rgba(0,102,204,0.05)'} 1px,transparent 1px)`,
          backgroundSize:'60px 60px' }} />
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-55%)', width:600, height:600,
          background:`radial-gradient(circle,${accentGlow} 0%,transparent 70%)`, pointerEvents:'none' }} />

        <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:20,
          opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(24px)', transition:'opacity 0.7s ease,transform 0.7s ease' }}>

          {/* Logo — fixed container so swap doesn't shift layout */}
          <div style={{ width:300, height:240, maxWidth:'85vw', display:'flex', alignItems:'center', justifyContent:'center',
            filter:`drop-shadow(0 0 40px ${accentGlow})` }}>
            <img
              src={dark ? "/GitGud-dark.png" : "/GitGud-logo-transparent.png"}
              alt="GitGud"
              style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', transition:'opacity 0.3s ease' }}
            />
          </div>

          <p style={{ color:subtext, fontSize:16, margin:0, textAlign:'center', maxWidth:340 }}>
            Watch clips. Vote smart. Level up your game sense.
          </p>

          <button
            style={{ marginTop:8, background:accent, color: dark?'#000':'#fff', border:'none', borderRadius:10,
              padding:'14px 48px', fontSize:16, fontWeight:700, cursor:'pointer',
              boxShadow:`0 0 24px ${accentGlow}`, transition:'box-shadow 0.15s, transform 0.15s' }}
            onClick={onLogin}
            onMouseEnter={e => { e.currentTarget.style.boxShadow=`0 0 36px ${accentGlow}`; e.currentTarget.style.transform='translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow=`0 0 24px ${accentGlow}`; e.currentTarget.style.transform='translateY(0)' }}>
            Get Started
          </button>

          <p style={{ color: dark?'#444':'#aaa', fontSize:12, margin:0 }}>Free to join · No credit card needed</p>

          <div style={{ marginTop:32, display:'flex', flexDirection:'column', alignItems:'center', gap:6, opacity:0.45 }}>
            <span style={{ color:subtext, fontSize:11, letterSpacing:'0.1em' }}>SCROLL TO LEARN MORE</span>
            <span style={{ color:accent, fontSize:20, display:'inline-block', animation:'bounce 2s infinite' }}>↓</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{ background: dark?'#181818':'#fff', borderTop:`1px solid ${border}`, padding:'80px 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <h2 style={{ color:text, fontSize:28, fontWeight:800, textAlign:'center', margin:'0 0 12px', letterSpacing:'-0.02em' }}>
            How GitGud Works
          </h2>
          <p style={{ color:subtext, fontSize:15, textAlign:'center', margin:'0 0 48px' }}>
            A community-driven platform to sharpen your game sense through voting and discussion.
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:20 }}>
            {features.map(f => (
              <div key={f.title} style={{ background:surface, border:`1px solid ${border}`, borderRadius:14,
                padding:'24px 20px', display:'flex', flexDirection:'column', gap:10,
                boxShadow:`0 0 20px ${dark?'rgba(255,106,0,0.05)':'rgba(0,102,204,0.05)'}` }}>
                <span style={{ fontSize:28 }}>{f.icon}</span>
                <span style={{ color:text, fontWeight:700, fontSize:15 }}>{f.title}</span>
                <span style={{ color:subtext, fontSize:13, lineHeight:1.6 }}>{f.desc}</span>
              </div>
            ))}
          </div>

          <div style={{ textAlign:'center', marginTop:52 }}>
            <button style={{ background:accent, color: dark?'#000':'#fff', border:'none', borderRadius:10,
              padding:'14px 48px', fontSize:16, fontWeight:700, cursor:'pointer',
              boxShadow:`0 0 24px ${accentGlow}` }} onClick={onLogin}>
              Join Now
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}`}</style>
    </div>
  )
}
