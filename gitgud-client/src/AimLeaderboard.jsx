import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import { TITLES } from "./titles";

export default function AimLeaderboard({ currentUid }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const { theme } = useTheme();
  const dark = theme === "dark";

  // Same styling constants used in Leaderboard.jsx
  const accent      = dark ? "#ff6a00"               : "#0066cc";
  const cardBg      = dark ? "#181818"               : "#f7f9fc";
  const meBg        = dark ? "rgba(255,106,0,0.07)"  : "rgba(0,102,204,0.06)";
  const meBorder    = dark ? "rgba(255,106,0,0.5)"   : "rgba(0,102,204,0.4)";
  const border      = dark ? "rgba(255,255,255,0.06)": "rgba(0,0,0,0.08)";
  const textPri     = dark ? "#f0f0f0"               : "#111";
  const textSub     = dark ? "#555"                  : "#777";
  const barBg       = dark ? "rgba(255,255,255,0.06)": "rgba(0,0,0,0.07)";
  const barFill     = dark
    ? "linear-gradient(90deg,#ff6a00,#ffaa00)"
    : "linear-gradient(90deg,#0066cc,#00aaff)";
  const avatarColor = dark ? "#000" : "#fff";

  const isBetterScore = (newScore, currentBest) => {
    if (!currentBest) return true;
    if (newScore.hits > currentBest.hits) return true;
    if (newScore.hits < currentBest.hits) return false;

    if (newScore.accuracy > currentBest.accuracy) return true;
    if (newScore.accuracy < currentBest.accuracy) return false;

    if (newScore.misses < currentBest.misses) return true;

    return false;
  };

  useEffect(() => {
    async function loadLeaderboard() {
  try {
    // Load aim results
    const resultsSnap = await getDocs(collection(db, "aimResults"));

    // Load users (same source used by Leaderboard.jsx)
    const usersSnap = await getDocs(collection(db, "users"));

    // Build a lookup table: uid -> user data
    const usersMap = {};
    usersSnap.docs.forEach((doc) => {
      usersMap[doc.id] = doc.data();
    });

    const bestScores = {};

    resultsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const uid = data.userId || "guest";

      if (isBetterScore(data, bestScores[uid])) {
        const userData = usersMap[uid] || {};

        bestScores[uid] = {
          uid,
          id: doc.id,
          ...data,

          // Override with canonical user data
          username:
            userData.username ||
            userData.displayName ||
            data.username ||
            "Anonymous",

          displayName: userData.displayName || "",
          photoURL: userData.photoURL || "",
          equippedTitle: userData.equippedTitle || null,
          titleFont: userData.titleFont || "default"
        };
      }
    });

    const sorted = Object.values(bestScores)
      .sort((a, b) => {
        if (b.hits !== a.hits) return b.hits - a.hits;
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
        if (a.misses !== b.misses) return a.misses - b.misses;
        return 0;
      })
      .slice(0, 20)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    setEntries(sorted);
  } catch (error) {
    console.error("Error loading aim leaderboard:", error);
  } finally {
    setLoading(false);
  }
}

    loadLeaderboard();
  }, []);

  const medal = (r) =>
    r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : null;

  return (
    <div
      style={{
        maxWidth: 460,
        margin: "0 auto",
        padding: "32px 16px",
        fontFamily: "'Segoe UI','Helvetica Neue',sans-serif",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            color: accent,
            fontSize: 26,
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.03em",
          }}
        >
          Aim Trainer Leaderboard
        </h2>
        <p
          style={{
            color: textSub,
            fontSize: 13,
            margin: "4px 0 0",
          }}
        >
          Top 20 players by best score
        </p>
      </div>

      {loading && (
        <p style={{ color: textSub, fontSize: 14 }}>
          Loading…
        </p>
      )}

      {!loading && entries.length === 0 && (
        <p style={{ color: textSub, fontSize: 14 }}>
          No aim scores yet!
        </p>
      )}

      {!loading && entries.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {entries.map((entry) => {
            const name = entry.username || entry.displayName || "Anonymous";
            const titleData = TITLES.find( t => t.id === entry.equippedTitle );
            const isMe = entry.uid === currentUid;
            const m = medal(entry.rank);

            // Use accuracy as the progress bar fill
            const pct = Math.max(
              0,
              Math.min(100, Number(entry.accuracy) || 0)
            );

            return (
              <div
                key={entry.uid}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: isMe ? meBg : cardBg,
                  border: `1.5px solid ${
                    isMe ? meBorder : border
                  }`,
                  borderRadius: 12,
                  padding: "10px 14px",
                }}
              >
                {/* Rank / Medal */}
                <span
                  style={{
                    fontSize: m ? 20 : 13,
                    fontWeight: 700,
                    color: textSub,
                    minWidth: 28,
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  {m ?? entry.rank}
                </span>

                {/* Avatar */}
                {entry.photoURL ? (
                  <img
                    src={entry.photoURL}
                    alt={name}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: accent,
                      color: avatarColor,
                      fontWeight: 800,
                      fontSize: 15,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {name[0]?.toUpperCase()}
                  </div>
                )}

                {/* Name + Accuracy Bar */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
    flexWrap: "wrap"
  }}
>
  <span
    style={{
      color: textPri,
      fontSize: 14,
      fontWeight: 600,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }}
  >
    {name}
  </span>

  {titleData && (
    <span
      className={`font-${entry.titleFont || "default"}`}
      style={{
        color: accent,
        fontSize: 16,
        fontWeight: 700,
        flexShrink: 0
      }}
    >
      • {titleData.title}
    </span>
  )}

  {isMe && (
    <span
      style={{
        background: accent,
        color: avatarColor,
        fontSize: 10,
        fontWeight: 800,
        padding: "1px 7px",
        borderRadius: 99,
        flexShrink: 0
      }}
    >
      you
    </span>
  )}
</div>

                  {/* Accuracy progress bar */}
                  <div
                    style={{
                      height: 4,
                      background: barBg,
                      borderRadius: 99,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: barFill,
                        borderRadius: 99,
                      }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 2,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      color: accent,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {entry.hits} hits
                  </span>
                  <span
                    style={{
                      color: textSub,
                      fontSize: 11,
                    }}
                  >
                    {entry.accuracy}% acc • {entry.misses} miss
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}