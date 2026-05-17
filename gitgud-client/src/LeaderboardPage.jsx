import Leaderboard from "./Leaderboard";
import AimLeaderboard from "./AimLeaderboard";
import { useTheme } from "./context/ThemeContext";
import ReactionLeaderboard from "./ReactionLeaderboard";


export default function LeaderboardPage({ currentUid }) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  const cardBg = dark ? "#181818" : "#f7f9fc";
  const border = dark
    ? "rgba(255,255,255,0.06)"
    : "rgba(0,0,0,0.08)";
  const accent = dark ? "#ff6a00" : "#0066cc";
  const textSub = dark ? "#555" : "#777";

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "32px 16px 48px",
        fontFamily: "'Segoe UI','Helvetica Neue',sans-serif",
      }}
    >
      {/* Page Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        <h1
          style={{
            color: accent,
            fontSize: 34,
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.03em",
          }}
        >
          Global Leaderboards
        </h1>
        <p
          style={{
            color: textSub,
            fontSize: 13,
            margin: "6px 0 0",
          }}
        >
          Compare your overall XP progression and Aim Trainer high scores.
        </p>
      </div>

      {/* Three visible boxes side by side */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >

        {/* Aim Leaderboard Card */}
        <div
          style={{
            background: cardBg,
            border: `1.5px solid ${border}`,
            borderRadius: 20,
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <AimLeaderboard currentUid={currentUid} />
        </div>

        {/* XP Leaderboard Card */}
        <div
          style={{
            background: cardBg,
            border: `1.5px solid ${border}`,
            borderRadius: 20,
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <Leaderboard currentUid={currentUid} />
        </div>

        {/* Reaction Leaderboard Card */}
<div
  style={{
    background: cardBg,
    border: `1.5px solid ${border}`,
    borderRadius: 20,
    overflow: "hidden",
    minWidth: 0,
  }}
>
  <ReactionLeaderboard currentUid={currentUid} />
</div>
      </div>
    </div>
  );
}