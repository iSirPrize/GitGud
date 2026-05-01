import { Navigate, Link } from "react-router-dom";
import { useTheme } from "./context/ThemeContext";
import { usePoints } from "./usePoints";

const cards = [
  {
    to: "/quiz",
    label: "Quiz",
    tagline: "Think you know your agents?",
    desc: "Game sense. Map knowledge. Lore you definitely didn't skip.",
    preview: "https://res.cloudinary.com/dyis0klmz/image/upload/v1777185621/ValorantSplash_siafhc.jpg",
  },
  {
    to: "/practice",
    label: "Aim Trainer",
    tagline: "Your aim isn't gonna fix itself.",
    desc: "Click heads. Build muscle memory. Blame your mouse anyway.",
    preview: null,
  },
  {
    to: "/leaderboard",
    label: "Leaderboard",
    tagline: "Glory or humiliation. Both are motivating.",
    desc: "Top 20 players ranked by XP. Where do you stand?",
    preview: null,
  },
  {
    to: null,
    label: "Profile",
    tagline: "You, but as a stat sheet.",
    desc: "Track your XP, level up, and watch your progress compound.",
    preview: null,
    isProfile: true,
  },
];

function AimPreview({ accent }) {
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%" style={{ display: "block" }}>
      <circle cx="80" cy="50" r="36" fill="none" stroke={accent} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
      <circle cx="80" cy="50" r="22" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.6" />
      <circle cx="80" cy="50" r="10" fill="none" stroke={accent} strokeWidth="2" opacity="0.9" />
      <circle cx="80" cy="50" r="3" fill={accent} />
      <line x1="80" y1="14" x2="80" y2="30" stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <line x1="80" y1="70" x2="80" y2="86" stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <line x1="44" y1="50" x2="60" y2="50" stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <line x1="100" y1="50" x2="116" y2="50" stroke={accent} strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

function LeaderboardPreview({ accent, textSub }) {
  const bars = [72, 100, 55, 40, 30];
  const names = ["#1", "#2", "#3", "#4", "#5"];
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%" style={{ display: "block" }}>
      {bars.map((h, i) => (
        <g key={i}>
          <rect x={12 + i * 30} y={90 - h * 0.7} width={18} height={h * 0.7} rx="3"
            fill={i === 0 ? accent : "rgba(128,128,128,0.25)"} opacity={i === 0 ? 1 : 0.7} />
          <text x={21 + i * 30} y={96} textAnchor="middle" fontSize="8" fill={textSub}>{names[i]}</text>
        </g>
      ))}
    </svg>
  );
}

function ProfilePreview({ accent }) {
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%" style={{ display: "block" }}>
      <circle cx="80" cy="34" r="18" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.7" />
      <circle cx="80" cy="34" r="7" fill={accent} opacity="0.5" />
      <path d="M44 88 Q44 66 80 66 Q116 66 116 88" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <rect x="30" y="76" width="30" height="4" rx="2" fill={accent} opacity="0.3" />
      <rect x="30" y="84" width="20" height="3" rx="1.5" fill={accent} opacity="0.2" />
      <rect x="100" y="76" width="30" height="4" rx="2" fill={accent} opacity="0.3" />
      <rect x="100" y="84" width="20" height="3" rx="1.5" fill={accent} opacity="0.2" />
    </svg>
  );
}

function Home({ user }) {
  const { theme } = useTheme();
  const { xp, level, pct, xpToNext, isMax } = usePoints(user?.uid);

  if (user === undefined) return <div style={{ color: "var(--qc-text)", padding: "2rem" }}>Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;

  const dark = theme === "dark";
  const accent = dark ? "#ff6a00" : "#0066cc";
  const accentGlow = dark ? "rgba(255,106,0,0.5)" : "rgba(0,102,204,0.4)";
  const textSub = dark ? "#888" : "#777";
  const barBg = dark ? "rgba(255,106,0,0.12)" : "rgba(0,102,204,0.12)";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "2.5rem 2rem 3rem",
      minHeight: "100%",
      boxSizing: "border-box",
    }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem", width: "100%", maxWidth: 680 }}>
        <p style={{
          color: accent,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          margin: "0 0 6px",
          opacity: 0.85,
        }}>
          Welcome back
        </p>
        <h1 style={{
          margin: "0 0 16px",
          fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
          fontWeight: 800,
          color: "var(--qc-text)",
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
        }}>
          {user.displayName || user.email?.split("@")[0] || "Player"}
        </h1>

        {/* XP meter */}
        <div style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          background: dark ? "rgba(255,106,0,0.07)" : "rgba(0,102,204,0.06)",
          border: `1px solid ${dark ? "rgba(255,106,0,0.2)" : "rgba(0,102,204,0.2)"}`,
          borderRadius: 12,
          padding: "10px 20px",
          minWidth: 240,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            <span style={{ color: accent, fontSize: 13, fontWeight: 800 }}>Level {level}</span>
            <span style={{ color: textSub, fontSize: 12 }}>{xp} xp</span>
          </div>
          <div style={{ width: "100%", height: 6, background: barBg, borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              width: `${pct}%`,
              height: "100%",
              background: accent,
              borderRadius: 99,
              boxShadow: `0 0 8px ${accentGlow}`,
              transition: "width 0.5s cubic-bezier(0.34,1.56,0.64,1)",
            }} />
          </div>
          <span style={{ color: textSub, fontSize: 11 }}>
            {isMax ? "MAX LEVEL" : `${xpToNext} xp to Level ${level + 1}`}
          </span>
        </div>
      </div>

      {/* 2×2 grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "1.1rem",
        width: "100%",
        maxWidth: 740,
      }}>
        {cards.map((card) => {
          const to = card.isProfile ? `/profile/${user.uid}` : card.to;

          return (
            <Link key={card.label} to={to} style={{ textDecoration: "none" }}>
              <div
                style={{
                  background: "var(--qc-surface)",
                  border: "1.5px solid rgba(128,128,128,0.12)",
                  borderRadius: 14,
                  overflow: "hidden",
                  height: "100%",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.borderColor = accent;
                  e.currentTarget.style.boxShadow = `0 0 18px var(--qc-frame-glow)`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "rgba(128,128,128,0.12)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* Preview */}
                <div style={{
                  height: 140,
                  background: dark ? "#111" : "#eef2f7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  position: "relative",
                }}>
                  {card.preview ? (
                    <>
                      <img src={card.preview} alt={card.label}
                        style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }} />
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)"
                      }} />
                    </>
                  ) : card.label === "Aim Trainer" ? (
                    <AimPreview accent={accent} />
                  ) : card.label === "Leaderboard" ? (
                    <LeaderboardPreview accent={accent} textSub={textSub} />
                  ) : (
                    <ProfilePreview accent={accent} />
                  )}
                </div>

                {/* Text */}
                <div style={{ padding: "16px 18px 18px" }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    display: "block",
                    marginBottom: 5,
                  }}>
                    {card.label}
                  </span>
                  <p style={{ margin: "0 0 5px", fontSize: 15, fontWeight: 700, color: "var(--qc-text)", lineHeight: 1.3 }}>
                    {card.tagline}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: textSub, lineHeight: 1.5 }}>
                    {card.desc}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default Home;