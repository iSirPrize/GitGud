// UserQuizCarousel.jsx
// Plays user-created quizzes. Supports all 4 question types:
//   video_mc    — YouTube embed, pauses at a moment, 4-option multiple choice
//   text_mc     — Text question, 4-option multiple choice, no video
//   rank        — Drag-and-drop ranking (text only)
//   enter_value — Free-text answer with flexible numeric matching
//
// Legacy quizzes (no `questions` array, just top-level fields) are normalised
// into the new shape on load so old data keeps working unchanged.
//
// SOLID:
//   S – Each question type player is its own component
//   O – New types registered in PLAYER_RENDERERS, no existing code changes
//   L – All renderers share (scenario, selected, submitted, onSelect, onSubmit) props
//
// Gherkin:
//   Given a user navigates to /user-quiz/play/:gameId
//   When quizzes load
//   Then each question renders its correct type
//
//   Given a rank question is shown
//   When the player drags cards
//   Then the order updates in real time
//
//   Given an enter_value question is shown
//   When the player types "$4000"
//   Then it matches the stored answer "4000" correctly

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import { awardPoints } from "./usePoints";
import CommentSection from "./components/CommentSection";
import CommunityVote from "./components/CommunityVote";
import "./components/QuizCarousel.css";
import "./UserQuizCarousel.css";
import FavVideoButton from "./components/FavVideoButton"; // for testing, can remove or replace with a "favourite this quiz" button if you like

// ── Value answer matching (mirrors adminQuizUtils logic, no shared import needed) ─
function normaliseValue(raw) {
  if (!raw) return "";
  return String(raw).toLowerCase().replace(/[$£€¥]/g, "").replace(/,/g, "").trim();
}
function extractNums(s) { return (s.match(/\d+/g) ?? []).join(""); }
function isValueCorrect(player, correct) {
  const np = normaliseValue(player);
  const nc = normaliseValue(correct);
  if (np === nc) return true;
  const n1 = extractNums(np);
  const n2 = extractNums(nc);
  return n1.length > 0 && n1 === n2;
}
function isRankCorrect(playerOrder, correctOrder) {
  if (!Array.isArray(playerOrder) || !Array.isArray(correctOrder)) return false;
  if (playerOrder.length !== correctOrder.length) return false;
  return playerOrder.every((v, i) => v === correctOrder[i]);
}

// ── Normalise legacy Firestore docs into the new `questions` array shape ───────
function normaliseScenario(data) {
  if (Array.isArray(data.questions) && data.questions.length > 0) return data;
  // Legacy: single video_mc question stored at top level
  return {
    ...data,
    questions: [{
      type:         "video_mc",
      videoId:      data.videoId,
      videoTitle:   data.videoTitle ?? "",
      ytUrl:        data.ytUrl ?? "",
      pauseAt:      data.pauseAt ?? 8,
      question:     data.question ?? "",
      choices:      data.choices ?? [],
      correctIndex: data.correctIndex ?? 0,
      reason:       data.reason ?? "",
    }],
  };
}

// ── YouTube IFrame loader ──────────────────────────────────────────────────────
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
      window.onYouTubeIframeAPIReady = () => { ytApiReady = true; ytApiCallbacks.forEach(cb => cb()); ytApiCallbacks = []; };
    }
  });
}

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

// ─────────────────────────────────────────────────────────────────────────────
// ── Question player renderers ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const CHOICE_LABELS = ["A", "B", "C", "D", "E", "F"];

// Shared MC choices UI
function McChoices({ q, playerAnswer, submitted, onSelect }) {
  return (
    <div className="panel-choices">
      {q.choices.map((choice, idx) => {
        let cls = "choice-btn";
        if (submitted) {
          cls += " locked";
          if (idx === q.correctIndex) cls += " correct";
          else if (idx === playerAnswer) cls += " wrong";
        } else if (playerAnswer === idx) cls += " selected";
        return (
          <button key={idx} className={cls} onClick={() => !submitted && onSelect(idx)} disabled={submitted}>
            <span className="choice-label">{CHOICE_LABELS[idx]}</span>
            <span className="choice-text">{choice}</span>
            {submitted && idx === q.correctIndex && <span className="choice-icon">correct</span>}
            {submitted && idx === playerAnswer && idx !== q.correctIndex && <span className="choice-icon wrong">wrong</span>}
          </button>
        );
      })}
    </div>
  );
}

// video_mc renderer — just shows the MC choices; video is handled above in the frame
function VideoMcRenderer({ q, playerAnswer, submitted, onSelect }) {
  const isCorrect = submitted && playerAnswer === q.correctIndex;
  return (
    <>
      <McChoices q={q} playerAnswer={playerAnswer} submitted={submitted} onSelect={onSelect} />
      {submitted && (
        <div className={`explanation-box ${isCorrect ? "correct" : "wrong"}`}>
          {isCorrect
            ? <p className="explanation-verdict correct">Correct! +10 points</p>
            : <>
                <p className="explanation-verdict wrong">Wrong answer</p>
                <p className="explanation-chosen">
                  You chose &ldquo;<strong>{q.choices[playerAnswer]}</strong>&rdquo;. Correct: &ldquo;<strong>{q.choices[q.correctIndex]}</strong>&rdquo;.
                </p>
              </>
          }
          <p className="explanation-reason"><span className="reason-label">Why:</span> {q.reason}</p>
          <p className="explanation-next">Watch the clip to see the outcome...</p>
        </div>
      )}
    </>
  );
}

// text_mc renderer — same UI, no video needed
function TextMcRenderer({ q, playerAnswer, submitted, onSelect }) {
  const isCorrect = submitted && playerAnswer === q.correctIndex;
  return (
    <>
      <McChoices q={q} playerAnswer={playerAnswer} submitted={submitted} onSelect={onSelect} />
      {submitted && (
        <div className={`explanation-box ${isCorrect ? "correct" : "wrong"}`}>
          {isCorrect
            ? <p className="explanation-verdict correct">Correct! +10 points</p>
            : <>
                <p className="explanation-verdict wrong">Wrong answer</p>
                <p className="explanation-chosen">
                  You chose &ldquo;<strong>{q.choices[playerAnswer]}</strong>&rdquo;. Correct: &ldquo;<strong>{q.choices[q.correctIndex]}</strong>&rdquo;.
                </p>
              </>
          }
          <p className="explanation-reason"><span className="reason-label">Why:</span> {q.reason}</p>
        </div>
      )}
    </>
  );
}

// rank renderer
function RankRenderer({ q, playerAnswer, submitted, onSelect }) {
  const initial = q.items.map((_, i) => i);
  const order   = playerAnswer ?? initial;
  const dragRef = useRef(null);

  const handleDragStart = (e, pos) => {
    if (submitted) return;
    dragRef.current = pos;
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDrop = (e, pos) => {
    e.preventDefault();
    if (submitted || dragRef.current === null || dragRef.current === pos) return;
    const updated = [...order];
    const [moved] = updated.splice(dragRef.current, 1);
    updated.splice(pos, 0, moved);
    onSelect(updated);
    dragRef.current = null;
  };

  const isCorrect = submitted && isRankCorrect(order, q.correctOrder);

  return (
    <div className="uqp-rank-player">
      <p className="uqp-rank-hint">Drag the cards into the correct order. Top = 1st, bottom = last.</p>
      <div className="uqp-rank-list">
        {order.map((itemIdx, pos) => {
          let cls = "uqp-rank-card";
          if (submitted) cls += order[pos] === q.correctOrder[pos] ? " correct-pos" : " wrong-pos";
          return (
            <div key={`rank-${pos}`} className={cls}
              draggable={!submitted}
              onDragStart={e => handleDragStart(e, pos)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, pos)}>
              <span className="uqp-rank-pos">{pos + 1}</span>
              <span className="uqp-rank-text">{q.items[itemIdx]}</span>
              {!submitted && <span className="uqp-drag-handle">drag</span>}
            </div>
          );
        })}
      </div>
      {submitted && (
        <div className={`explanation-box ${isCorrect ? "correct" : "wrong"}`}>
          {isCorrect
            ? <p className="explanation-verdict correct">Correct ranking! +10 points</p>
            : <>
                <p className="explanation-verdict wrong">Incorrect ranking</p>
                <div className="uqp-correct-order">
                  <p className="uqp-co-label">Correct order:</p>
                  {q.correctOrder.map((idx, pos) => (
                    <div key={pos} className="uqp-co-row">
                      <span className="uqp-co-num">{pos + 1}</span>
                      <span>{q.items[idx]}</span>
                    </div>
                  ))}
                </div>
              </>
          }
          <p className="explanation-reason"><span className="reason-label">Why:</span> {q.reason}</p>
        </div>
      )}
    </div>
  );
}

// enter_value renderer
function EnterValueRenderer({ q, playerAnswer, submitted, onSelect }) {
  const isCorrect = submitted && isValueCorrect(playerAnswer ?? "", q.correctAnswer);
  return (
    <div className="uqp-value-player">
      <input
        className={`uqp-value-input ${submitted ? (isCorrect ? "correct" : "wrong") : ""}`}
        placeholder="Type your answer..."
        value={playerAnswer ?? ""}
        onChange={e => !submitted && onSelect(e.target.value)}
        disabled={submitted}
      />
      <p className="uqp-value-hint">Numbers matched flexibly — "$4000", "4000", and "4,000" all accepted.</p>
      {submitted && (
        <div className={`explanation-box ${isCorrect ? "correct" : "wrong"}`}>
          {isCorrect
            ? <p className="explanation-verdict correct">Correct! +10 points</p>
            : <>
                <p className="explanation-verdict wrong">Incorrect</p>
                <p className="explanation-chosen">
                  You answered: <strong>{playerAnswer || "(blank)"}</strong> — correct: <strong>{q.correctAnswer}</strong>
                </p>
              </>
          }
          <p className="explanation-reason"><span className="reason-label">Why:</span> {q.reason}</p>
        </div>
      )}
    </div>
  );
}

// Dispatch map (Open/Closed)
const PLAYER_RENDERERS = {
  video_mc:    VideoMcRenderer,
  text_mc:     TextMcRenderer,
  rank:        RankRenderer,
  enter_value: EnterValueRenderer,
};

// ── Check if a question answer is correct ─────────────────────────────────────
function isAnswerCorrect(q, answer) {
  if (q.type === "video_mc" || q.type === "text_mc") return answer === q.correctIndex;
  if (q.type === "enter_value") return isValueCorrect(answer ?? "", q.correctAnswer);
  if (q.type === "rank") return isRankCorrect(answer ?? q.items.map((_, i) => i), q.correctOrder);
  return false;
}

// ── Can submit check ──────────────────────────────────────────────────────────
function canSubmitQuestion(q, answer) {
  if (q.type === "video_mc" || q.type === "text_mc") return answer !== null && answer !== undefined;
  if (q.type === "enter_value") return answer !== null && answer !== undefined && String(answer).trim() !== "";
  if (q.type === "rank") return true; // always has a default order
  return false;
}

const GAME_LABELS = { valorant: "Valorant", cs2: "Counter-Strike 2", other: "Other Games" };

// ── Main component ─────────────────────────────────────────────────────────────
export default function UserQuizCarousel({ user }) {
  const { gameId, scenarioId }  = useParams();
  const { theme }   = useTheme();
  const isDark      = theme === "dark";
  const navigate    = useNavigate();

  const [scenarios,    setScenarios]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [current, setCurrent] = useState(0);
  const [currentQ,     setCurrentQ]     = useState(0); // question index within scenario
  const [answers,      setAnswers]      = useState([]);   // answers[scenarioIdx][questionIdx]
  const [submitted,    setSubmitted]    = useState([]);   // submitted[scenarioIdx][questionIdx]
  const [videoPaused,  setVideoPaused]  = useState([]);
  const [sliding,      setSliding]      = useState(null);
  const [showComplete, setShowComplete] = useState(false);

  const advanceTimer = useRef(null);
  const touchStartX  = useRef(null);

  // ── Fetch approved quizzes ─────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, "userQuizzes"), where("game", "==", gameId), where("approved", "==", true)));
        const docs = snap.docs.map(d => normaliseScenario({ id: d.id, ...d.data() }));
        setScenarios(docs);
        if (scenarioId) {
        const idx = docs.findIndex( (s) => String(s.id) === String(scenarioId));if (idx >= 0) {setCurrent(idx);}}
        setAnswers(docs.map(d => Array(d.questions.length).fill(null)));
        setSubmitted(docs.map(d => Array(d.questions.length).fill(false)));
        setVideoPaused(docs.map(d => Array(d.questions.length).fill(false)));
      } catch (err) {
        console.error("Failed to load user quizzes:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [gameId]);

  // Reset currentQ when scenario changes
  useEffect(() => { setCurrentQ(0); }, [current]);

  const total         = scenarios.length;
  const scenario      = scenarios[current];
  const questions     = scenario?.questions ?? [];
  const qTotal        = questions.length;
  const q             = questions[currentQ];
  const isSubmittedQ  = submitted[current]?.[currentQ] ?? false;
  const playerAnswer  = answers[current]?.[currentQ] ?? null;
  const isVideoPaused = videoPaused[current]?.[currentQ] ?? false;
  const isVideoQ      = q?.type === "video_mc";

  // All questions in this scenario submitted?
  const allQsSubmitted = submitted[current]?.every(Boolean) ?? false;

  // Total correct across all scenarios and all questions
  const totalCorrect = scenarios.reduce((acc, sc, si) => {
    return acc + sc.questions.reduce((qAcc, question, qi) => {
      return qAcc + (submitted[si]?.[qi] && isAnswerCorrect(question, answers[si]?.[qi]) ? 1 : 0);
    }, 0);
  }, 0);
  const totalQuestions = scenarios.reduce((acc, sc) => acc + sc.questions.length, 0);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleVideoPaused = useCallback(() => {
    setVideoPaused(prev => {
      const n = prev.map(a => [...a]);
      if (n[current]) n[current][currentQ] = true;
      return n;
    });
  }, [current, currentQ]);

  const handleVideoEnded = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      if (currentQ < qTotal - 1) setCurrentQ(cq => cq + 1);
      else goTo("next");
    }, 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, currentQ, qTotal]);

  const goTo = (direction) => {
    if (sliding) return;
    if (advanceTimer.current) { clearTimeout(advanceTimer.current); advanceTimer.current = null; }
    const next = direction === "next" ? (current + 1) % total : (current - 1 + total) % total;
    setSliding(direction === "next" ? "left" : "right");
    setTimeout(() => { setCurrent(next); setSliding(null); }, 280);
  };

  const handleTouchStart = e => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = e => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(diff > 0 ? "next" : "prev");
    touchStartX.current = null;
  };

  const handleSelect = (val) => {
    if (isSubmittedQ) return;
    setAnswers(prev => {
      const n = prev.map(a => [...a]);
      if (n[current]) n[current][currentQ] = val;
      return n;
    });
  };

  const handleSubmit = async () => {
    if (!canSubmitQuestion(q, playerAnswer)) return;
    setSubmitted(prev => {
      const n = prev.map(a => [...a]);
      if (n[current]) n[current][currentQ] = true;
      return n;
    });
    const correct = isAnswerCorrect(q, playerAnswer ?? (q.type === "rank" ? q.items.map((_, i) => i) : null));
    if (correct && user?.uid) awardPoints(user.uid, 10).catch(console.error);

    // Check if entire quiz set is done
    const allDone = submitted.every((sarr, si) =>
      si === current
        ? sarr.map((s, qi) => qi === currentQ ? true : s).every(Boolean)
        : sarr.every(Boolean)
    );
    if (allDone && currentQ === qTotal - 1 && current === total - 1) {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => setShowComplete(true), 60000);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`quiz-carousel ${isDark ? "dark" : "light"}`} style={{ justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--qc-subtext)" }}>Loading quizzes...</p>
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (!loading && total === 0) {
    return (
      <div className={`quiz-carousel ${isDark ? "dark" : "light"}`} style={{ justifyContent: "center", alignItems: "center", textAlign: "center", gap: 16 }}>
        <h2 style={{ color: "var(--qc-text)" }}>No {GAME_LABELS[gameId] ?? gameId} quizzes yet</h2>
        <p style={{ color: "var(--qc-subtext)", maxWidth: 400 }}>Be the first to create one! User quizzes are reviewed before going live.</p>
        <button style={{ marginTop: 16, background: "var(--qc-frame)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }} onClick={() => navigate("/user-quiz/create")}>
          Create a Quiz
        </button>
        <button style={{ background: "transparent", border: "1px solid var(--qc-input-border, #444)", color: "var(--qc-subtext)", borderRadius: 8, padding: "10px 20px", cursor: "pointer" }} onClick={() => navigate("/user-quiz")}>
          Back
        </button>
      </div>
    );
  }

  // ── Complete screen ────────────────────────────────────────────────────────
  if (showComplete) {
    const pct = Math.round((totalCorrect / totalQuestions) * 100);
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
            <div className="complete-icon">{pct === 100 ? "star" : pct >= 60 ? "done" : "circle"}</div>
            <h1 className="complete-title">Quiz Complete!</h1>
            <p className="complete-rank" style={{ color: rank.color }}>{rank.label}</p>
            <div className="complete-score-wrap">
              <div className="complete-score-label"><span>Your Score</span><span className="complete-fraction">{totalCorrect} / {totalQuestions}</span></div>
              <div className="complete-bar-track"><div className="complete-bar-fill" style={{ width: `${pct}%`, background: rank.color }} /></div>
              <div className="complete-pct">{pct}%</div>
            </div>
            <p className="complete-points">+{totalCorrect * 10} points earned</p>
            <div className="complete-actions">
              <button className="complete-retry-btn" onClick={() => {
                setShowComplete(false); setCurrent(0); setCurrentQ(0);
                setAnswers(scenarios.map(d => Array(d.questions.length).fill(null)));
                setSubmitted(scenarios.map(d => Array(d.questions.length).fill(false)));
                setVideoPaused(scenarios.map(d => Array(d.questions.length).fill(false)));
              }}>Try Again</button>
              <button className="complete-review-btn" onClick={() => setShowComplete(false)}>Review Answers</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main quiz UI ───────────────────────────────────────────────────────────
  const Renderer = q ? PLAYER_RENDERERS[q.type] : null;
  const needsVideoGate = isVideoQ && !isVideoPaused && !isSubmittedQ;

  return (
    <div className={`quiz-carousel ${isDark ? "dark" : "light"}`}>
      {/* Breadcrumb */}
      <div style={{ alignSelf: "flex-start", marginBottom: 8 }}>
        <button onClick={() => navigate("/user-quiz")}
          style={{ background: "none", border: "none", color: "var(--qc-frame)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, padding: 0 }}>
          User Quizzes
        </button>
        <span style={{ color: "var(--qc-subtext)", fontSize: "0.85rem" }}> / {GAME_LABELS[gameId] ?? gameId}</span>
      </div>

      {/* Progress dots — one per scenario */}
      <div className="quiz-progress">
        {scenarios.map((_, i) => (
          <span key={i} className={`dot ${i === current ? "active" : ""} ${submitted[i]?.every(Boolean) ? "done" : ""}`} />
        ))}
      </div>

      {/* Slide */}
      <div className={`quiz-slide ${sliding ? `slide-out-${sliding}` : "slide-in"}`} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

        {/* Creator credit */}
        {scenario?.createdByName && (
          <p style={{ color: "var(--qc-subtext)", fontSize: "0.78rem", alignSelf: "center", marginBottom: 4 }}>
          </p>
        )}

        {scenario?.createdByName && (
  <p
    style={{
      color: "var(--qc-subtext)",
      fontSize: "0.78rem",
      alignSelf: "center",
      marginBottom: 4,
    }}
  >
    Quiz by{" "}
    <strong style={{ color: "var(--qc-text)" }}>
      {scenario.createdByName}
    </strong>
  </p>
)}

<div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
  <FavVideoButton
    clip={{
  id: `${gameId}-${scenario.id}`,
  title: scenario.question,
  videoId: scenario.youtubeId,
  game: gameId,
  videoPath: `/user-quiz/play/${gameId}/${scenario.id}`,
}}
  />
</div>

        {/* Multi-question progress within a scenario */}
        {qTotal > 1 && (
          <div className="uqp-q-tabs">
            {questions.map((_, qi) => (
              <button key={qi}
                className={`uqp-q-tab ${qi === currentQ ? "active" : ""} ${submitted[current]?.[qi] ? "done" : ""}`}
                onClick={() => setCurrentQ(qi)}>
                Q{qi + 1}
              </button>
            ))}
          </div>
        )}

        {/* Video frame — only shown for video_mc questions */}
        {isVideoQ && (
          <div className="quiz-row">
            <button className="nav-arrow" onClick={() => goTo("prev")} aria-label="Previous">&#9664;</button>
            <div className="video-frame">
              <div className="video-label">
                <span className="scenario-counter">{current + 1} / {total}{qTotal > 1 ? ` — Q${currentQ + 1}/${qTotal}` : ""}</span>
                {!isVideoPaused && !isSubmittedQ && <span className="video-hint">Play the clip — it will pause at the key moment</span>}
                {isVideoPaused && !isSubmittedQ && <span className="video-hint paused">Paused — pick your answer below</span>}
                {isSubmittedQ && <span className="video-hint resumed">Resuming to show the outcome...</span>}
              </div>
              <YoutubePlayer
                key={`uq-${scenario?.id}-${current}-${currentQ}`}
                youtubeId={q?.videoId}
                pauseAt={q?.pauseAt ?? 8}
                onPaused={handleVideoPaused}
                onVideoEnded={handleVideoEnded}
                isSubmitted={isSubmittedQ}
                scenarioId={`${scenario?.id}-${currentQ}`}
              />
            </div>
            <button className="nav-arrow" onClick={() => goTo("next")} aria-label="Next">&#9654;</button>
          </div>
        )}

        {/* Non-video scenario: show nav arrows inline with question header */}
        {!isVideoQ && (
          <div className="uqp-text-nav-row">
            <button className="nav-arrow" onClick={() => goTo("prev")} aria-label="Previous">&#9664;</button>
            <span className="scenario-counter" style={{ color: "var(--qc-subtext)", fontSize: "0.8rem" }}>{current + 1} / {total}{qTotal > 1 ? ` — Q${currentQ + 1}/${qTotal}` : ""}</span>
            <button className="nav-arrow" onClick={() => goTo("next")} aria-label="Next">&#9654;</button>
          </div>
        )}

        {/* Answer panel */}
        <div className={`quiz-panel ${(isVideoQ ? isVideoPaused : true) || isSubmittedQ ? "panel-active" : "panel-waiting"}`}>

          {/* Video gate — waiting for video to pause */}
          {needsVideoGate && (
            <div className="panel-waiting-msg">
              <span className="waiting-icon">[ ]</span>
              <p>Watch the clip — your question will appear here when the video pauses.</p>
            </div>
          )}

          {/* Question + answer UI */}
          {(!isVideoQ || isVideoPaused || isSubmittedQ) && (
            <>
              <div className="panel-question">
                <span className="q-badge">Q{currentQ + 1}</span>
                {q?.type && q.type !== "video_mc" && (
                  <span className="uqp-type-badge">{q.type.replace("_", " ")}</span>
                )}
                <p>{q?.question}</p>
              </div>

              {Renderer && (
                <Renderer
                  q={q}
                  playerAnswer={playerAnswer}
                  submitted={isSubmittedQ}
                  onSelect={handleSelect}
                />
              )}

              {/* Submit / next question controls */}
              <div className="uqp-controls">
                {!isSubmittedQ ? (
                  <button
                    className="submit-btn"
                    onClick={handleSubmit}
                    disabled={!canSubmitQuestion(q, playerAnswer)}
                  >
                    Check Answer
                  </button>
                ) : currentQ < qTotal - 1 ? (
                  <button className="submit-btn submitted" onClick={() => setCurrentQ(cq => cq + 1)}>
                    Next Question
                  </button>
                ) : allQsSubmitted && current < total - 1 ? (
                  <button className="submit-btn submitted" onClick={() => goTo("next")}>
                    Next Quiz
                  </button>
                ) : allQsSubmitted && current === total - 1 ? (
                  <button className="submit-btn submitted" onClick={() => setShowComplete(true)}>
                    See Results
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>

        <CommunityVote quizId={`uq-${scenario?.id}-${currentQ}`} choices={q?.choices ?? []} userChoice={q?.type === "video_mc" || q?.type === "text_mc" ? playerAnswer : null} correctIndex={q?.correctIndex} isSubmitted={isSubmittedQ} />
        <CommentSection quizId={`uq-${scenario?.id}`} />
      </div>
    </div>
  );
}
