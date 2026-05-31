// UserQuizPage.jsx
// Drop this file into: gitgud-client/src/UserQuizPage.jsx
// Change from original: "My Quizzes" cards are now clickable and navigate to the quiz

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import "./UserQuizPage.css";

const SUPPORTED_GAMES = [
  { id: "valorant", name: "Valorant", accent: "#ff4655", image: "https://res.cloudinary.com/dyis0klmz/image/upload/v1777185621/ValorantSplash_siafhc.jpg", description: "Community Valorant clips and plays" },
  { id: "cs2",      name: "Counter-Strike 2", accent: "#eeb02a", image: "https://res.cloudinary.com/dyis0klmz/image/upload/v1777185626/CS2Spalsh_sg4smz.jpg", description: "Community CS2 clips and plays" },
  { id: "other",    name: "Other Games", accent: "#a855f7", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop", description: "Everything else — apex, overwatch, fortnite…" },
];

const GAME_LABELS = { valorant: "Valorant", cs2: "Counter-Strike 2", other: "Other Games" };

export default function UserQuizPage({ user }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [counts,    setCounts]    = useState({});
  const [myQuizzes, setMyQuizzes] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [myLoading, setMyLoading] = useState(true);
  const [deleting,  setDeleting]  = useState(null);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const snap = await getDocs(query(collection(db, "userQuizzes"), where("approved", "==", true)));
        const c = {};
        snap.forEach(d => { const g = d.data().game || "other"; c[g] = (c[g] || 0) + 1; });
        setCounts(c);
      } catch (err) { console.error("Failed to load quiz counts:", err); }
      finally { setLoading(false); }
    }
    fetchCounts();
  }, []);

  useEffect(() => {
    if (!user?.uid) { setMyLoading(false); return; }
    async function fetchMine() {
      try {
        const snap = await getDocs(query(collection(db, "userQuizzes"), where("createdBy", "==", user.uid)));
        setMyQuizzes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error("Failed to load my quizzes:", err); }
      finally { setMyLoading(false); }
    }
    fetchMine();
  }, [user?.uid]);

  const handleDelete = async (quizId, e) => {
    e.stopPropagation(); // don't navigate when deleting
    if (!window.confirm("Delete this quiz? This cannot be undone.")) return;
    setDeleting(quizId);
    try {
      await deleteDoc(doc(db, "userQuizzes", quizId));
      setMyQuizzes(prev => prev.filter(q => q.id !== quizId));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete. Please try again.");
    } finally { setDeleting(null); }
  };

  return (
    <div className={`uq-page ${isDark ? "dark" : "light"}`}>
      {/* Header */}
      <div className="uq-header">
        <div className="uq-header-text">
          <h1 className="uq-title">User Quizzes</h1>
          <p className="uq-sub">Community-made quizzes — play, or create your own</p>
        </div>
        <button className="uq-create-btn" onClick={() => navigate("/user-quiz/create")} title="Create a new quiz from your own YouTube clips">
          <span className="uq-create-icon">＋</span> Create a Quiz
        </button>
      </div>

      {/* My Quizzes section */}
      {user && (
        <div className="uq-my-section">
          <div className="uq-my-header">
            <div className="uq-my-avatar">
              {user.photoURL
                ? <img src={user.photoURL} alt="avatar" />
                : <span>{(user.displayName || "U").charAt(0).toUpperCase()}</span>
              }
            </div>
            <div>
              <h2 className="uq-my-title">My Quizzes</h2>
              <p className="uq-my-sub">{user.displayName || "Your submitted quizzes"}</p>
            </div>
          </div>

          {myLoading ? (
            <p className="uq-my-loading">Loading your quizzes…</p>
          ) : myQuizzes.length === 0 ? (
            <div className="uq-my-empty">
              <p>You haven't created any quizzes yet.</p>
              <button className="uq-create-btn" onClick={() => navigate("/user-quiz/create")}>
                <span className="uq-create-icon">＋</span> Create Your First Quiz
              </button>
            </div>
          ) : (
            <div className="uq-my-list">
              {myQuizzes.map(quiz => (
                // ── Clickable card: approved quizzes navigate to the quiz ──
                <div
                  key={quiz.id}
                  className={`uq-my-card ${quiz.approved ? "clickable" : ""}`}
                  onClick={() => quiz.approved && navigate(`/user-quiz/play/${quiz.game ?? "other"}/${quiz.id}`)}
                  title={quiz.approved ? "Click to play this quiz" : undefined}
                  style={{ cursor: quiz.approved ? "pointer" : "default" }}
                >
                  <div className="uq-my-card-info">
                    <span className={`uq-status-badge ${quiz.approved ? "approved" : quiz.flagged ? "flagged" : "pending"}`}>
                      {quiz.approved ? "✓ Live" : quiz.flagged ? "✗ Rejected" : "⏳ Awaiting Approval"}
                    </span>
                    {/* Show the quiz question — falls back to title for multi-question quizzes */}
                    <p className="uq-my-question">
                      {quiz.questions?.[0]?.question || quiz.question || "What is the play here?"}
                    </p>
                    <p className="uq-my-meta">
                      {GAME_LABELS[quiz.game] ?? quiz.game}
                      {quiz.videoTitle ? ` · ${quiz.videoTitle.slice(0, 40)}${quiz.videoTitle.length > 40 ? "…" : ""}` : ""}
                      {quiz.approved && <span className="uq-play-hint"> — click to play ▶</span>}
                    </p>
                  </div>
                  <button
                    className="uq-my-delete"
                    onClick={(e) => handleDelete(quiz.id, e)}
                    disabled={deleting === quiz.id}
                    title="Delete this quiz"
                  >
                    {deleting === quiz.id ? "…" : "Delete"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Game panels */}
      <h2 className="uq-browse-title">Browse by Game</h2>
      <div className="uq-panels">
        {SUPPORTED_GAMES.map(game => {
          const count = counts[game.id] ?? 0;
          return (
            <div key={game.id} className="uq-panel" style={{ "--game-accent": game.accent }}>
              <div className="uq-panel-img-wrap">
                <img src={game.image} alt={game.name} className="uq-panel-img" />
                <div className="uq-panel-overlay" />
                <div className="uq-panel-game-name">{game.name}</div>
              </div>
              <div className="uq-panel-body">
                <p className="uq-panel-desc">{game.description}</p>
                {loading ? (
                  <div className="uq-panel-loading">Loading…</div>
                ) : count === 0 ? (
                  <div className="uq-panel-empty">
                    <p>No quizzes yet. Be the first to create one!</p>
                    <button className="uq-panel-create-btn" onClick={() => navigate("/user-quiz/create")}>Create {game.name} Quiz</button>
                  </div>
                ) : (
                  <Link to={`/user-quiz/play/${game.id}`} className="uq-panel-play-link">
                    <span className="uq-play-count">{count} quiz{count !== 1 ? "zes" : ""} available</span>
                    <span className="uq-play-arrow">Play →</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
