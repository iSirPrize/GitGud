// AdminPanel.jsx
// Drop into: gitgud-client/src/AdminPanel.jsx
//
// Access: only users with isAdmin: true in their Firestore users/{uid} doc can see this page.
// Route: /admin
//
// Gherkin:
//   Given a user with isAdmin: true navigates to /admin
//   When the page loads
//   Then a tab bar shows "Quiz Submissions" and "Critique Posts"
//   And pending items in each collection are shown for review
//
//   Given an admin views a pending submission
//   When the oEmbed title contains non-gameplay keywords
//   Then a mismatch warning is shown in the card
//
//   Given an admin clicks Approve: Go Live
//   When the action completes
//   Then approved is set to true and the card is removed from the queue
//
//   Given an admin clicks Reject
//   When confirmed
//   Then flagged is set to true and the card is removed from the queue
//
//   Given a non-admin navigates to /admin
//   Then an access denied message is shown

import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import "./AdminPanel.css";

// ── YouTube IFrame loader ─────────────────────────────────────────────────────
let ytApiReady = false;
let ytApiCallbacks = [];
function loadYouTubeApi() {
  if (ytApiReady || (window.YT && window.YT.Player)) { ytApiReady = true; return Promise.resolve(); }
  return new Promise((resolve) => {
    ytApiCallbacks.push(resolve);
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => {
        ytApiReady = true;
        ytApiCallbacks.forEach((cb) => cb());
        ytApiCallbacks = [];
      };
    }
  });
}

function MiniPlayer({ videoId }) {
  const divRef = useRef(null);
  const playerRef = useRef(null);
  useEffect(() => {
    if (!videoId) return;
    let alive = true;
    loadYouTubeApi().then(() => {
      if (!alive || !divRef.current) return;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (_) {} }
      playerRef.current = new window.YT.Player(divRef.current, {
        videoId,
        playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
      });
    });
    return () => {
      alive = false;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (_) {} playerRef.current = null; }
    };
  }, [videoId]);
  return (
    <div className="ap-player-wrap">
      <div ref={divRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}

// ── Free Layer 1 content check: oEmbed title keyword scan ────────────────────
// No API key required — uses the video title stored at submission time.
// Catches obvious mismatches (cartoons, cat videos, music, etc.)
const MISMATCH_KEYWORDS = [
  "simpsons","cartoon","anime","movie","film","trailer","music video",
  "vlog","podcast","funny","compilation","cats","dogs","pets","cooking",
  "food","tutorial","review","unboxing","reaction","challenge","prank",
  "kids","baby","family","news","weather","nfl","nba","fifa","recipe",
];

function checkTitleMismatch(videoTitle) {
  if (!videoTitle) return null;
  const lower = videoTitle.toLowerCase();
  const hit = MISMATCH_KEYWORDS.find((kw) => lower.includes(kw));
  if (hit) return `Title contains "${hit}" — check this is actually gameplay.`;
  return null;
}

const GAME_LABELS     = { valorant: "Valorant", cs2: "Counter-Strike 2", other: "Other" };
const CATEGORY_LABELS = { wrong: "What am I doing wrong?", highlight: "Check this play out" };

// ── Moderation card ───────────────────────────────────────────────────────────
function ModerationCard({ item, type, acting, expanded, onToggleExpand, onApprove, onReject }) {
  const mismatch = checkTitleMismatch(item.videoTitle);

  return (
    <div className="ap-card">
      <div className="ap-card-top">
        <div className="ap-card-meta">
          {type === "quiz" ? (
            <span className="ap-game-tag">{GAME_LABELS[item.game] ?? item.game}</span>
          ) : (
            <span className="ap-game-tag ap-cat-tag">
              {CATEGORY_LABELS[item.category] ?? item.category}
            </span>
          )}
          <span className="ap-creator">
            by {item.creatorName || item.createdByName || "Unknown"}
          </span>
        </div>
        <button className="ap-preview-toggle" onClick={onToggleExpand}>
          {expanded ? "Hide Preview" : "Watch Clip"}
        </button>
      </div>

      {item.videoTitle && (
        <p className="ap-video-title">Video: {item.videoTitle}</p>
      )}

      {mismatch && (
        <div className="ap-mismatch-warning">
          Content check: {mismatch}
        </div>
      )}

      {type === "critique" && item.title && (
        <p className="ap-post-title">Post title: "{item.title}"</p>
      )}

      {expanded && <MiniPlayer videoId={item.videoId} />}

      <div className="ap-card-content">
        {type === "quiz" && (
          <>
            <div className="ap-field">
              <span className="ap-field-label">Question</span>
              <span className="ap-field-value">{item.question}</span>
            </div>
            <div className="ap-field">
              <span className="ap-field-label">Pause at</span>
              <span className="ap-field-value">{item.pauseAt}s</span>
            </div>
            <div className="ap-field">
              <span className="ap-field-label">Correct</span>
              <span className="ap-field-value ap-correct">
                {item.choices?.[item.correctIndex]}
              </span>
            </div>
            <div className="ap-field">
              <span className="ap-field-label">Other options</span>
              <span className="ap-field-value">
                {item.choices?.filter((_, i) => i !== item.correctIndex).join(" / ")}
              </span>
            </div>
            <div className="ap-field">
              <span className="ap-field-label">Explanation</span>
              <span className="ap-field-value">{item.reason}</span>
            </div>
          </>
        )}
        {type === "critique" && (
          <div className="ap-field">
            <span className="ap-field-label">Category</span>
            <span className="ap-field-value">
              {CATEGORY_LABELS[item.category] ?? item.category}
            </span>
          </div>
        )}
      </div>

      <div className="ap-actions">
        <button
          className="ap-approve-btn"
          onClick={() => onApprove(item.id)}
          disabled={acting === item.id}
        >
          {acting === item.id ? "..." : "Approve: Go Live"}
        </button>
        <button
          className="ap-reject-btn"
          onClick={() => onReject(item.id)}
          disabled={acting === item.id}
        >
          {acting === item.id ? "..." : "Reject"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminPanel({ user }) {
  const { theme } = useTheme();
  const isDark    = theme === "dark";

  const [isAdmin,   setIsAdmin]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState("quiz");
  const [quizzes,   setQuizzes]   = useState([]);
  const [critiques, setCritiques] = useState([]);
  const [acting,    setActing]    = useState(null);
  const [expanded,  setExpanded]  = useState(null);

  useEffect(() => {
    if (!user?.uid) { setIsAdmin(false); setLoading(false); return; }
    async function check() {
      try {
        const snap = await getDocs(
          query(collection(db, "users"), where("__name__", "==", user.uid))
        );
        setIsAdmin(!snap.empty && snap.docs[0].data().isAdmin === true);
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }
    check();
  }, [user?.uid]);

  useEffect(() => {
    if (!isAdmin) return;
    async function fetchPending() {
      try {
        const [quizSnap, critiqueSnap] = await Promise.all([
          getDocs(query(
            collection(db, "userQuizzes"),
            where("approved", "==", false),
            where("flagged",  "==", false)
          )),
          getDocs(query(
            collection(db, "critiquePosts"),
            where("approved", "==", false),
            where("flagged",  "==", false)
          )),
        ]);
        setQuizzes(quizSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCritiques(critiqueSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load pending items:", err);
      }
    }
    fetchPending();
  }, [isAdmin]);

  const handleApprove = async (id, collectionName, setter) => {
    setActing(id);
    try {
      await updateDoc(doc(db, collectionName, id), { approved: true });
      setter((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      alert("Failed to approve. Try again.");
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id, collectionName, setter) => {
    if (!window.confirm("Reject this submission? The creator will see it as Rejected.")) return;
    setActing(id);
    try {
      await updateDoc(doc(db, collectionName, id), { flagged: true });
      setter((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      alert("Failed to reject. Try again.");
    } finally {
      setActing(null);
    }
  };

  if (isAdmin === false) {
    return (
      <div className={`ap-page quiz-carousel ${isDark ? "dark" : "light"}`}>
        <div className="ap-denied">
          <h2>Access Denied</h2>
          <p>You don't have admin privileges to view this page.</p>
        </div>
      </div>
    );
  }

  if (isAdmin === null || loading) {
    return (
      <div className={`ap-page quiz-carousel ${isDark ? "dark" : "light"}`}>
        <p style={{ color: "var(--qc-subtext)" }}>Loading...</p>
      </div>
    );
  }

  const activeItems    = activeTab === "quiz" ? quizzes : critiques;
  const collectionName = activeTab === "quiz" ? "userQuizzes" : "critiquePosts";
  const setter         = activeTab === "quiz" ? setQuizzes  : setCritiques;

  return (
    <div className={`ap-page quiz-carousel ${isDark ? "dark" : "light"}`}>
      <div className="ap-header">
        <h1 className="ap-title">Admin: Moderation</h1>
        <p className="ap-sub">
          Review user submissions before they go live. Watch the clip, check the video title
          matches the selected game or category, then approve or reject. Titles flagged by
          the content check are highlighted automatically.
        </p>
        <div className="ap-underline" />
      </div>

      <div className="ap-tabs">
        <button
          className={`ap-tab ${activeTab === "quiz" ? "active" : ""}`}
          onClick={() => { setActiveTab("quiz"); setExpanded(null); }}
        >
          Quiz Submissions
          {quizzes.length > 0 && <span className="ap-badge">{quizzes.length}</span>}
        </button>
        <button
          className={`ap-tab ${activeTab === "critique" ? "active" : ""}`}
          onClick={() => { setActiveTab("critique"); setExpanded(null); }}
        >
          Critique Posts
          {critiques.length > 0 && <span className="ap-badge">{critiques.length}</span>}
        </button>
      </div>

      {activeItems.length === 0 ? (
        <div className="ap-empty">
          <h2>All caught up!</h2>
          <p>No {activeTab === "quiz" ? "quiz submissions" : "critique posts"} awaiting review.</p>
        </div>
      ) : (
        <>
          <p className="ap-count">
            {activeItems.length} item{activeItems.length !== 1 ? "s" : ""} awaiting review
          </p>
          <div className="ap-list">
            {activeItems.map((item) => (
              <ModerationCard
                key={item.id}
                item={item}
                type={activeTab}
                acting={acting}
                expanded={expanded === item.id}
                onToggleExpand={() => setExpanded(expanded === item.id ? null : item.id)}
                onApprove={(id) => handleApprove(id, collectionName, setter)}
                onReject={(id)  => handleReject(id, collectionName, setter)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
