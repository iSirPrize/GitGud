import { useEffect, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "./firebase"
import { useTheme } from "./context/ThemeContext"
import { getLevelProgress } from "./usePoints"

export default function Leaderboard({ currentUid }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()
  const dark = theme === "dark"

  const accent      = dark ? "#ff6a00"               : "#0066cc"
  const cardBg      = dark ? "#181818"               : "#f7f9fc"
  const meBg        = dark ? "rgba(255,106,0,0.07)"  : "rgba(0,102,204,0.06)"
  const meBorder    = dark ? "rgba(255,106,0,0.5)"   : "rgba(0,102,204,0.4)"
  const border      = dark ? "rgba(255,255,255,0.06)": "rgba(0,0,0,0.08)"
  const textPri     = dark ? "#f0f0f0"               : "#111"
  const textSub     = dark ? "#555"                  : "#777"
  const barBg       = dark ? "rgba(255,255,255,0.06)": "rgba(0,0,0,0.07)"
  const barFill     = dark ? "linear-gradient(90deg,#ff6a00,#ffaa00)" : "linear-gradient(90deg,#0066cc,#00aaff)"
  const avatarColor = dark ? "#000" : "#fff"

  useEffect(() => {
    getDocs(collection(db, "users"))
      .then(snap => {
        const sorted = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .sort((a, b) => (b.xp ?? b.points ?? 0) - (a.xp ?? a.points ?? 0))
          .slice(0, 20)
          .map((e, i) => ({ ...e, rank: i + 1 }))
        setEntries(sorted)
        setLoading(false)
      })
  }, [])

  const medal = r => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : null

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px", fontFamily: "'Segoe UI','Helvetica Neue',sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: accent, fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.03em" }}>Leaderboard</h2>
        <p style={{ color: textSub, fontSize: 13, margin: "4px 0 0" }}>Top 20 players by XP</p>
      </div>

      {loading && <p style={{ color: textSub, fontSize: 14 }}>Loading…</p>}
      {!loading && entries.length === 0 && <p style={{ color: textSub, fontSize: 14 }}>No players yet!</p>}

      {!loading && entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {entries.map(e => {
            const name = e.username || e.displayName || "Anonymous"
            const isMe = e.uid === currentUid
            const xp   = e.xp ?? e.points ?? 0
            const { level, pct, xpToNext, isMax } = getLevelProgress(xp)
            const m    = medal(e.rank)

            return (
              <div key={e.uid} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: isMe ? meBg : cardBg,
                border: `1.5px solid ${isMe ? meBorder : border}`,
                borderRadius: 12, padding: "10px 14px",
              }}>
                <span style={{ fontSize: m ? 20 : 13, fontWeight: 700, color: textSub, minWidth: 28, textAlign: "center", flexShrink: 0 }}>
                  {m ?? e.rank}
                </span>
                {e.photoURL
                  ? <img src={e.photoURL} alt={name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 36, height: 36, borderRadius: "50%", background: accent, color: avatarColor, fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {name[0]?.toUpperCase()}
                    </div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <span style={{ color: textPri, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                    {isMe && <span style={{ background: accent, color: avatarColor, fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 99, flexShrink: 0 }}>you</span>}
                  </div>
                  <div style={{ height: 4, background: barBg, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: barFill, borderRadius: 99 }} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                  <span style={{ color: accent, fontSize: 12, fontWeight: 700 }}>Lvl {level}</span>
                  <span style={{ color: textSub, fontSize: 11 }}>{isMax ? "MAX" : `${xpToNext} xp to next`}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}