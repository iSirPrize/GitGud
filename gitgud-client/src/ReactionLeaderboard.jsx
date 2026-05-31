import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import { TITLES } from "./titles";

export default function ReactionLeaderboard({ currentUid }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const { theme } = useTheme();
  const dark = theme === "dark";

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

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(collection(db, "reactionResults"));
        const usersSnap = await getDocs(collection(db, "users"));

        const users = {};
        usersSnap.docs.forEach(doc => {
          users[doc.id] = doc.data();
        });

        const bestByUser = {};

        snap.docs.forEach(doc => {
          const data = doc.data();
          const uid = data.userId || "guest";

          const current = bestByUser[uid];

          // LOWER average is better
          const isBetter =
            !current ||
            data.average < current.average ||
            (data.average === current.average && data.best < current.best);

          if (isBetter) {
            const u = users[uid] || {};

            bestByUser[uid] = {
              uid,
              ...data,
              username: u.username || u.displayName || data.username || "Anonymous",
              displayName: u.displayName || "",
              photoURL: u.photoURL || "",
              equippedTitle: u.equippedTitle || null,
              titleFont: u.titleFont || "default"
            };
          }
        });

        const sorted = Object.values(bestByUser)
          .sort((a, b) => a.average - b.average) // best average first
          .slice(0, 20)
          .map((entry, i) => ({ ...entry, rank: i + 1 }));

        setEntries(sorted);
      } catch (err) {
        console.error("Error loading reaction leaderboard", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const medal = r => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : null);

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "32px 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          color: accent,
          fontSize: 26,
          fontWeight: 800,
          margin: 0,
          letterSpacing: "-0.03em"
        }}>
          Reaction Trainer Leaderboard
        </h2>
        <p style={{ color: textSub, fontSize: 13, margin: "4px 0 0" }}>
          Top 20 fastest reaction times
        </p>
      </div>

      {loading && <p style={{ color: textSub }}>Loading…</p>}
      {!loading && entries.length === 0 && <p style={{ color: textSub }}>No results yet</p>}

      {!loading && entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {entries.map(entry => {
            const isMe = entry.uid === currentUid;
            const m = medal(entry.rank);
            const name = entry.username || entry.displayName || "Anonymous";
            const titleData = TITLES.find( t => t.id === entry.equippedTitle );

            const pct = Math.max(0, Math.min(100, 200 - entry.average)); // inverted: lower avg → fuller bar

            return (
              <div
                key={entry.uid}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: isMe ? meBg : cardBg,
                  border: `1.5px solid ${isMe ? meBorder : border}`,
                  borderRadius: 12,
                  padding: "10px 14px",
                }}
              >
                {/* Rank / Medal */}
                <span style={{
                  fontSize: m ? 20 : 13,
                  fontWeight: 700,
                  color: textSub,
                  minWidth: 28,
                  textAlign: "center",
                }}>
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
                    }}
                  />
                ) : (
                  <div style={{
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
                  }}>
                    {name[0]?.toUpperCase()}
                  </div>
                )}

                {/* Name + bar */}
                <div style={{ flex: 1 }}>
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

                  {/* Reaction progress bar (lower avg = better = more filled) */}
                  <div style={{
                    height: 4,
                    background: barBg,
                    borderRadius: 99,
                    overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: barFill,
                    }} />
                  </div>
                </div>

                {/* Stats */}
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: accent, fontSize: 12, fontWeight: 700 }}>
                    {entry.average} ms avg
                  </span>
                  <br />
                  <span style={{ color: textSub, fontSize: 11 }}>
                    best {entry.best} ms
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
