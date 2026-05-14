// UserQuizCarousel.jsx
// Drop into: gitgud-client/src/UserQuizCarousel.jsx
//
// Gherkin:
//   Given the user navigates to /user-quiz/play/:gameId
//   When the page loads
//   Then approved user quizzes for that game are fetched from Firestore
//   And displayed in the same carousel style as the main quiz
//
//   Given quizzes are loaded
//   When the video plays and hits the pauseAt second
//   Then the video pauses and the question is shown
//
//   Given the user selects an answer and clicks Check Answer
//   When the answer is submitted
//   Then correct/wrong feedback is shown with the explanation
//   And 10 points are awarded for a correct answer
//
//   Given no approved quizzes exist for this game
//   When the page loads
//   Then an empty state message is shown with a link to create a quiz

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import { awardPoints } from "./usePoints";
import CommentSection from "./components/CommentSection";
import CommunityVote from "./components/CommunityVote";
import "./components/QuizCarousel.css"; // reuse existing styles

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

// ── YoutubePlayer (identical logic to QuizCarousel) ──────────────────────────
function YoutubePlayer({ youtubeId, pauseAt, onPaused, onVideoEnded, isSubmitted, scenarioId }) {
  const containerRef = useRef(null);
  const playerRef    = useRef(null);
  const pollRef      = useRef(null);
  const hasPausedRef = useRef(false);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const startPoll = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(() => {
      if (!playerRef.current) return;
      try {
        const t = playerRef.current.getCurrentTime();
        if (!hasPausedRef.current && t >= pauseAt) {
          playerRef.current.pauseVideo();
          hasPausedRef.current = true;
          onPaused();
          stopPoll();
        }
      } catch (_) {}
    }, 250);
  }, [pauseAt, onPaused]);

  useEffect(() => {
    let destroyed = false;
    loadYouTubeApi().then(() => {
      if (destroyed || !containerRef.current) return;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (_) {} playerRef.current = null; }
      hasPausedRef.current = false;
      stopPoll();
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: youtubeId,
        playerVars: { autoplay: 0, rel: 0, modestbranding: 1, start: 0 },
        events: {
          onStateChange: (event) => {
            if (event.data === 1 && !hasPausedRef.current) startPoll();
            if (event.data === 0) { stopPoll(); if (onVideoEnded) onVideoEnded(); }
          },
        },
      });
    });
    return () => {
      destroyed = true;
      stopPoll();
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (_) {} playerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId, scenarioId]);

  useEffect(() => {
    if (isSubmitted && playerRef.current && hasPausedRef.current) {
      try { playerRef.current.playVideo(); } catch (_) {}
    }
  }, [isSubmitted]);

  return (
    <div className="video-wrapper">
      <div ref={containerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}

const GAME_LABELS = { valorant: "Valorant", cs2: "Counter-Strike 2", other: "Other Games" };

// ── Main component ────────────────────────────────────────────────────────────
export default function UserQuizCarousel({ user }) {
  const { gameId }  = useParams();
  const { theme }   = useTheme();
  const isDark      = theme === "dark";
  const navigate    = useNavigate();

  const [scenarios,    setScenarios]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [current,      setCurrent]      = useState(0);
  const [selected,     setSelected]     = useState([]);
  const [submitted,    setSubmitted]    = useState([]);
  const [videoPaused,  setVideoPaused]  = useState([]);
  const [sliding,      setSliding]      = useState(null);
  const [showComplete, setShowComplete] = useState(false);

  const advanceTimer = useRef(null);
  const touchStartX  = useRef(null);

  // ── Fetch approved quizzes for this game ───────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(
            collection(db, "userQuizzes"),
            where("game", "==", gameId),
            where("approved", "==", true)
          )
        );
        const docs = snap.docs.map((d, i) => ({ id: d.id, ...d.data(), _idx: i }));
        setScenarios(docs);
        setSelected(Array(docs.length).fill(null));
        setSubmitted(Array(docs.length).fill(false));
        setVideoPaused(Array(docs.length).fill(false));
      } catch (err) {
        console.error("Failed to load user quizzes:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [gameId]);

  const total       = scenarios.length;
  const scenario    = scenarios[current];
  const isSubmitted = submitted[current];
  const selectedIdx = selected[current];
  const isCorrect   = isSubmitted && selectedIdx === scenario?.correctIndex;
  const isVideoPaused = videoPaused[current];
  const correctCount  = submitted.filter((done, i) => done && selected[i] === scenarios[i]?.correctIndex).length;

  const handleVideoPaused = useCallback(() => {
    setVideoPaused((prev) => { const n = [...prev]; n[current] = true; return n; });
  }, [current]);

  const handleVideoEnded = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      const upd = submitted.map((s, i) => (i === current ? true : s));
      if (upd.every(Boolean) && current === total - 1) setShowComplete(true);
      else goTo("next");
    }, 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, submitted, total]);

  const goTo = (direction) => {
    if (sliding) return;
    if (advanceTimer.current) { clearTimeout(advanceTimer.current); advanceTimer.current = null; }
    const next = direction === "next" ? (current + 1) % total : (current - 1 + total) % total;
    setSliding(direction === "next" ? "left" : "right");
    setTimeout(() => { setCurrent(next); setSliding(null); }, 280);
  };

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(diff > 0 ? "next" : "prev");
    touchStartX.current = null;
  };

  const handleSelect = (idx) => {
    if (submitted[current]) return;
    const upd = [...selected]; upd[current] = idx; setSelected(upd);
  };

  const handleSubmit = async () => {
    if (selected[current] === null) return;
    const upd = [...submitted]; upd[current] = true; setSubmitted(upd);
    const correct = selected[current] === scenario.correctIndex;
    if (correct && user?.uid) awardPoints(user.uid, 10).catch(console.error);
    if (upd.every(Boolean) && current === total - 1) {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => setShowComplete(true), 60000);
    }
  };

  const choiceLabels = ["A", "B", "C", "D"];

  const getChoiceClass = (idx) => {
    let cls = "choice-btn";
    if (submitted[current]) {
      cls += " locked";
      if (idx === scenario.correctIndex) cls += " correct";
      else if (idx === selected[current]) cls += " wrong";
    } else if (selected[current] === idx) cls += " selected";
    return cls;
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`quiz-carousel ${isDark ? "dark" : "light"}`} style={{ justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--qc-subtext)" }}>Loading quizzes…</p>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!loading && total === 0) {
    return (
      <div className={`quiz-carousel ${isDark ? "dark" : "light"}`} style={{ justifyContent: "center", alignItems: "center", textAlign: "center", gap: 16 }}>
        <p style={{ fontSize: "3rem" }}>🎮</p>
        <h2 style={{ color: "var(--qc-text)" }}>No {GAME_LABELS[gameId] ?? gameId} quizzes yet</h2>
        <p style={{ color: "var(--qc-subtext)", maxWidth: 400 }}>
          Be the first to create one! User quizzes are reviewed before going live — check back soon.
        </p>
        <button
          style={{ marginTop: 16, background: "var(--qc-frame)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontWeight: 700, cursor: "pointer", fontSize: "0.95rem" }}
          onClick={() => navigate("/user-quiz/create")}
        >
          Create a Quiz
        </button>
        <button
          style={{ background: "transparent", border: "1px solid var(--qc-input-border, #444)", color: "var(--qc-subtext)", borderRadius: 8, padding: "10px 20px", cursor: "pointer" }}
          onClick={() => navigate("/user-quiz")}
        >
          ← Back
        </button>
      </div>
    );
  }

  // ── Complete screen ────────────────────────────────────────────────────────
  if (showComplete) {
    const pct  = Math.round((correctCount / total) * 100);
    const getRank = () => {
      if (pct === 100) return { label: "Perfect Score!", color: "#f59e0b" };
      if (pct >= 80)   return { label: "Great Work!",    color: "#22c55e" };
      if (pct >= 60)   return { label: "Not Bad!",       color: "#3b82f6" };
      return               { label: "Keep Practising",   color: "#ef4444" };
    };
    const rank = getRank();
    return (
      <div className={`quiz-carousel ${isDark ? "dark" : "light"}`}>
        <div className="complete-screen">
          <div className="complete-card">
            <div className="complete-icon">{pct === 100 ? "★" : pct >= 60 ? "✓" : "○"}</div>
            <h1 className="complete-title">Quiz Complete!</h1>
            <p className="complete-rank" style={{ color: rank.color }}>{rank.label}</p>
            <div className="complete-score-wrap">
              <div className="complete-score-label"><span>Your Score</span><span className="complete-fraction">{correctCount} / {total}</span></div>
              <div className="complete-bar-track"><div className="complete-bar-fill" style={{ width: `${pct}%`, background: rank.color }} /></div>
              <div className="complete-pct">{pct}%</div>
            </div>
            <div className="complete-breakdown">
              {scenarios.map((s, i) => {
                const wasCorrect = selected[i] === s.correctIndex;
                return (
                  <div key={i} className={`breakdown-row ${wasCorrect ? "bk-correct" : "bk-wrong"}`}>
                    <span className="bk-num">Q{i + 1}</span>
                    <span className="bk-icon">{wasCorrect ? "✓" : "✗"}</span>
                    <span className="bk-text">{s.question.length > 55 ? s.question.slice(0, 55) + "…" : s.question}</span>
                  </div>
                );
              })}
            </div>
            <p className="complete-points">+{correctCount * 10} points earned this quiz</p>
            <div className="complete-actions">
              <button className="complete-retry-btn" onClick={() => { setShowComplete(false); setCurrent(0); setSelected(Array(total).fill(null)); setSubmitted(Array(total).fill(false)); setVideoPaused(Array(total).fill(false)); }}>
                Try Again
              </button>
              <button className="complete-review-btn" onClick={() => setShowComplete(false)}>Review Answers</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz UI ────────────────────────────────────────────────────────────────
  return (
    <div className={`quiz-carousel ${isDark ? "dark" : "light"}`}>
      {/* Header breadcrumb */}
      <div style={{ alignSelf: "flex-start", marginBottom: 8 }}>
        <button
          onClick={() => navigate("/user-quiz")}
          style={{ background: "none", border: "none", color: "var(--qc-frame)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, padding: 0 }}
        >
          ← User Quizzes
        </button>
        <span style={{ color: "var(--qc-subtext)", fontSize: "0.85rem" }}> / {GAME_LABELS[gameId] ?? gameId}</span>
      </div>

      {/* Progress dots */}
      <div className="quiz-progress">
        {scenarios.map((_, i) => (
          <span key={i} className={`dot ${i === current ? "active" : ""} ${submitted[i] ? "done" : ""}`} />
        ))}
      </div>

      {/* Slide */}
      <div className={`quiz-slide ${sliding ? `slide-out-${sliding}` : "slide-in"}`} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

        {/* Creator credit */}
        {scenario?.createdByName && (
          <p style={{ color: "var(--qc-subtext)", fontSize: "0.78rem", alignSelf: "center", marginBottom: 4 }}>
            Quiz by <strong style={{ color: "var(--qc-text)" }}>{scenario.createdByName}</strong>
          </p>
        )}

        {/* Row: arrow + video + arrow */}
        <div className="quiz-row">
          <button className="nav-arrow" onClick={() => goTo("prev")} aria-label="Previous">&#9664;</button>
          <div className="video-frame">
            <div className="video-label">
              <span className="scenario-counter">{current + 1} / {total}</span>
              {!isVideoPaused && !isSubmitted && <span className="video-hint">▶ Play the clip — it will pause at the key moment</span>}
              {isVideoPaused && !isSubmitted && <span className="video-hint paused">⏸ Paused — pick your answer below</span>}
              {isSubmitted && <span className="video-hint resumed">▶ Resuming to show the outcome…</span>}
            </div>
            <YoutubePlayer
              key={`uq-${scenario?.id}-${current}`}
              youtubeId={scenario?.videoId}
              pauseAt={scenario?.pauseAt ?? 8}
              onPaused={handleVideoPaused}
              onVideoEnded={handleVideoEnded}
              isSubmitted={isSubmitted}
              scenarioId={scenario?.id}
            />
          </div>
          <button className="nav-arrow" onClick={() => goTo("next")} aria-label="Next">&#9654;</button>
        </div>

        {/* Answer panel */}
        <div className={`quiz-panel ${isVideoPaused || isSubmitted ? "panel-active" : "panel-waiting"}`}>
          {!isVideoPaused && !isSubmitted && (
            <div className="panel-waiting-msg">
              <span className="waiting-icon">[ ]</span>
              <p>Watch the clip — your question will appear here when the video pauses.</p>
            </div>
          )}
          {(isVideoPaused || isSubmitted) && (
            <>
              <div className="panel-question">
                <span className="q-badge">Q{current + 1}</span>
                <p>{scenario.question}</p>
              </div>
              <div className="panel-choices">
                {scenario.choices.map((choice, idx) => (
                  <button key={idx} className={getChoiceClass(idx)} onClick={() => handleSelect(idx)} disabled={isSubmitted}>
                    <span className="choice-label">{choiceLabels[idx]}</span>
                    <span className="choice-text">{choice}</span>
                    {isSubmitted && idx === scenario.correctIndex && <span className="choice-icon">✓</span>}
                    {isSubmitted && idx === selectedIdx && idx !== scenario.correctIndex && <span className="choice-icon">✗</span>}
                  </button>
                ))}
              </div>
              {isSubmitted && (
                <div className={`explanation-box ${isCorrect ? "correct" : "wrong"}`}>
                  {isCorrect
                    ? <p className="explanation-verdict correct">✓ Correct! +10 points</p>
                    : <>
                        <p className="explanation-verdict wrong">✗ Wrong answer!</p>
                        <p className="explanation-chosen">You chose &ldquo;<strong>{scenario.choices[selectedIdx]}</strong>&rdquo;. The correct play was &ldquo;<strong>{scenario.choices[scenario.correctIndex]}</strong>&rdquo;.</p>
                      </>
                  }
                  <p className="explanation-reason"><span className="reason-label">Why:</span> {scenario.reason}</p>
                  <p className="explanation-next">▶ Watch the clip to see the outcome — next question loads in a moment…</p>
                </div>
              )}
              <button className={`submit-btn ${isSubmitted ? "submitted" : ""}`} onClick={handleSubmit} disabled={selectedIdx === null || isSubmitted}>
                {isSubmitted ? "✓  Answer Submitted" : "Check Answer — Submit"}
              </button>
            </>
          )}
        </div>

        <CommunityVote quizId={`uq-${scenario?.id}`} choices={scenario?.choices ?? []} userChoice={selectedIdx} correctIndex={scenario?.correctIndex} isSubmitted={isSubmitted} />
        <CommentSection quizId={`uq-${scenario?.id}`} />
      </div>
    </div>
  );
}
