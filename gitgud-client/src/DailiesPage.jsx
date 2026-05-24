// DailiesPage.jsx
// Displays the user's 3 daily quests with live progress bars.
// Reads from useDailies hook — no direct Firestore calls here.

import { useTheme } from "./context/ThemeContext"
import { useDailies } from "./useDailies"

const TYPE_ICON = { aim: "🎯", quiz: "🧠", reaction: "⚡" }

export default function DailiesPage({ user }) {
  const { theme }               = useTheme()
  const { quests, loading }     = useDailies(user?.uid)
  const dark                    = theme === "dark"

  const accent   = dark ? "#ff6a00" : "#0066cc"
  const textSub  = dark ? "#888"    : "#777"
  const cardBg   = dark ? "#181818" : "#f7f9fc"
  const border   = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"
  const barBg    = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: "32px 16px", fontFamily: "'Segoe UI','Helvetica Neue',sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ color: accent, fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.03em" }}>
          Daily Quests
        </h2>
        <p style={{ color: textSub, fontSize: 13, margin: "4px 0 0" }}>
          3 new challenges every day — reset at midnight
        </p>
      </div>

      {loading && <p style={{ color: textSub, fontSize: 14 }}>Loading quests…</p>}

      {!loading && quests.length === 0 && (
        <p style={{ color: textSub, fontSize: 14 }}>No quests found. Try refreshing.</p>
      )}

      {/* Quest cards */}
      {!loading && quests.map((q) => {
        const pct  = Math.min(100, Math.round((q.progress / q.required) * 100))
        const done = q.done

        return (
          <div key={q.id} style={{
            background:   done ? (dark ? "rgba(34,197,94,0.07)" : "rgba(34,197,94,0.06)") : cardBg,
            border:       `1.5px solid ${done ? "#22c55e" : border}`,
            borderRadius: 14,
            padding:      "16px 18px",
            marginBottom: 12,
            transition:   "border-color 0.3s ease",
          }}>

            {/* Top row: icon + label + XP badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>{TYPE_ICON[q.type]}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: done ? "#22c55e" : "var(--qc-text)" }}>
                {q.label}
              </span>
              <span style={{
                background:   done ? "#22c55e" : accent,
                color:        dark ? "#000" : "#fff",
                fontSize:     11,
                fontWeight:   800,
                padding:      "2px 9px",
                borderRadius: 99,
                flexShrink:   0,
              }}>
                {done ? "✓ Done" : `+${q.xpReward} XP`}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ height: 6, background: barBg, borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
              <div style={{
                width:        `${pct}%`,
                height:       "100%",
                background:   done ? "#22c55e" : accent,
                borderRadius: 99,
                transition:   "width 0.4s ease",
              }} />
            </div>

            {/* Progress label */}
            <p style={{ margin: 0, fontSize: 12, color: textSub }}>
              {done ? "Quest complete! XP awarded." : `${q.progress} / ${q.required}`}
            </p>

          </div>
        )
      })}

      {/* Tip */}
      {!loading && (
        <p style={{ color: textSub, fontSize: 12, marginTop: 20, textAlign: "center" }}>
          Head to Practice or Quiz to make progress on your quests.
        </p>
      )}

    </div>
  )
}
