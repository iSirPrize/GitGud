import { useState, useRef, useEffect } from "react"
import { logout } from "./auth"
import { usePoints } from "./usePoints"
import { useTheme } from "./context/ThemeContext"

export function PointsMeter({ uid, style }) {
  const { points, level, loading } = usePoints(uid)
  const { theme } = useTheme()
  const dark = theme === "dark"
  const accent = dark ? "#ff6a00" : "#0066cc"
  const accentGlow = dark ? "rgba(255,106,0,0.5)" : "rgba(0,102,204,0.4)"
  if (loading) return null
  const pct = Math.min(points, 100)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px',
      background: dark ? 'rgba(255,106,0,0.07)' : 'rgba(0,102,204,0.07)',
      border:`1px solid ${dark ? 'rgba(255,106,0,0.2)' : 'rgba(0,102,204,0.2)'}`,
      borderRadius:10, ...style }}>
      <span style={{ color:accent, fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>Lvl {level}</span>
      <div style={{ width:100, height:6, background: dark ? 'rgba(255,106,0,0.15)' : 'rgba(0,102,204,0.15)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:accent, borderRadius:99,
          boxShadow:`0 0 6px ${accentGlow}`, transition:'width 0.5s cubic-bezier(0.34,1.56,0.64,1)' }} />
      </div>
      <span style={{ color: dark ? '#f0f0f0' : '#111', fontSize:12, fontWeight:600, whiteSpace:'nowrap' }}>
        {points}<span style={{ color: dark ? '#555' : '#aaa', fontWeight:400 }}>/100</span>
      </span>
    </div>
  )
}

export default function ProfileDropdown({ user }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const { points, level } = usePoints(user?.uid)
  const { theme } = useTheme()
  const dark = theme === "dark"

  const accent     = dark ? "#ff6a00" : "#0066cc"
  const accentGlow = dark ? "rgba(255,106,0,0.6)" : "rgba(0,102,204,0.5)"
  const surface    = dark ? "#181818" : "#ffffff"
  const border     = dark ? "rgba(255,106,0,0.25)" : "rgba(0,102,204,0.2)"
  const text       = dark ? "#f0f0f0" : "#111111"
  const subtext    = dark ? "#999"    : "#666"
  const avatarBg   = dark ? "linear-gradient(135deg,#ff6a00,#c44d00)" : "linear-gradient(135deg,#0066cc,#0044aa)"

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const name = user?.displayName || user?.email?.split("@")[0] || "Player"
  const pct  = Math.min(points, 100)

  const Avatar = ({ size, fontSize }) => user?.photoURL
    ? <img src={user.photoURL} alt={name} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
    : <div style={{ width:size, height:size, borderRadius:'50%', background:avatarBg, color:'#fff', fontWeight:700,
        fontSize, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {name[0]?.toUpperCase()}
      </div>

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background:'none', border:`2px solid ${dark ? 'rgba(255,106,0,0.4)' : 'rgba(0,102,204,0.4)'}`,
          borderRadius:'50%', padding:0, cursor:'pointer', width:38, height:38,
          overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
          transition:'border-color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = accent}
        onMouseLeave={e => e.currentTarget.style.borderColor = dark ? 'rgba(255,106,0,0.4)' : 'rgba(0,102,204,0.4)'}>
        <Avatar size={34} fontSize={15} />
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 10px)', right:0, background:surface,
          border:`1px solid ${border}`, borderRadius:14,
          boxShadow:`0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${border}`,
          width:260, padding:16, zIndex:1000,
          animation:'pdIn 0.15s ease' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <Avatar size={44} fontSize={18} />
            <div style={{ overflow:'hidden' }}>
              <div style={{ color:text, fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
              <div style={{ color:subtext, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>
            </div>
          </div>

          <div style={{ height:1, background:border, margin:'0 0 12px' }} />

          {/* Points */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:accent, fontWeight:700, fontSize:13 }}>Level {level}</span>
              <span style={{ color:subtext, fontSize:12 }}>{points} / 100 pts</span>
            </div>
            <div style={{ height:8, background: dark ? 'rgba(255,106,0,0.12)' : 'rgba(0,102,204,0.12)', borderRadius:99, overflow:'hidden' }}>
              <div style={{ width:`${pct}%`, height:'100%', background:accent, borderRadius:99,
                boxShadow:`0 0 8px ${accentGlow}`, transition:'width 0.5s cubic-bezier(0.34,1.56,0.64,1)' }} />
            </div>
            <div style={{ color: dark ? '#444' : '#bbb', fontSize:11, textAlign:'right' }}>{100 - points} pts to Level {level + 1}</div>
          </div>

          <div style={{ height:1, background:border, margin:'0 0 12px' }} />

          <button onClick={() => logout()}
            style={{ width:'100%', background:'rgba(239,68,68,0.08)', color:'#ef4444',
              border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:10,
              fontSize:13, fontWeight:600, cursor:'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.16)'; e.currentTarget.style.borderColor='rgba(239,68,68,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor='rgba(239,68,68,0.2)' }}>
            Sign Out
          </button>
        </div>
      )}
      <style>{`@keyframes pdIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
