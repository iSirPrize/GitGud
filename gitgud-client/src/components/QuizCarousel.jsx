// QuizCarousel.jsx
// Drop this file into: gitgud-client/src/components/QuizCarousel.jsx

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import CommentSection from "./CommentSection";
import CommunityVote from "./CommunityVote";
import "./QuizCarousel.css";
import { awardPoints } from "../usePoints";

// ─── Standard question used across ALL games ──────────────────────────────────
const STANDARD_QUESTION = "What is the play here?";

// ─── Scenario banks per game ──────────────────────────────────────────────────
// pauseAt  = second at which video pauses and question appears
// The video then resumes automatically once the user submits their answer
// YouTube ID is the part after "?v=" e.g. youtube.com/watch?v=3F6Exc9m-cQ → "3F6Exc9m-cQ"

const SCENARIOS_BY_GAME = {

  valorant: [
    {
      id: 1,
      youtubeId: "3F6Exc9m-cQ",
      pauseAt: 9,           // video pauses at 9s, question appears
      question: "You are the entry fragger for the team, what should you do here?",
      correctIndex: 2,      // C is correct
      choices: [
        "Rotate to A site",
        "Peek after another team member pushes out",
        "Peek with blastpack",
        "Wait for enemy to peek",
      ],
      reason: "Your enemy has started shooting at your boombot with a judge. Blastpacking past the angle disrupts their crosshair placement when they are already down shots in the judge.",
    },
    {
      id: 2,
      youtubeId: "4x7Q6mkNY7w",
      pauseAt: 5,           // video pauses at 5s
      question: "Your team has gathered enough info to determine at least 3 agents are A if not 4 and have decided to rotate. During rotation you have caught the B anchor flanking. What is the best play here?",
      correctIndex: 0,      // A is correct
      choices: [
        "Push enemy with blastpack to quickly rotate",
        "Hold the left angle for peek",
        "Hold the right angle for peek",
        "Go back to A",
      ],
      reason: "With the intel gathered and knowing that this is the anchor player, the faster they are killed the more time you have to get to B while directly covering B.",
    },
    {
      id: 3,
      youtubeId: "FwMZEQBZ8WA",
      pauseAt: 9,           // video pauses at 9s
      question: "After killing the B anchor during rotation, which path should you take to have the highest success in this round?",
      correctIndex: 1,      // B is correct
      choices: [
        "Push through B main",
        "Push B elbow",
        "Go back to mid",
        "Go back to A",
      ],
      reason: "Since you are the furthest ahead the team should be able to push safely. Going through elbow allows for multiple strong enemy cut offs including pinching any players getting to site or holding mid where your Jett has died.",
    },
    {
      id: 4,
      youtubeId: "76vYbf_1A8U",
      pauseAt: 5,           // video pauses at 5s
      question: "You're holding a one and done spot. What should you do while the enemy is taking site?",
      correctIndex: 3,      // D is correct
      choices: [
        "It's a one and done spot — move to a retreat and get to a different spot",
        "Hold tight and wait for the spike to get planted before taking action",
        "Bait your Sage and hide",
        "Peek with Sage",
      ],
      reason: "Peeking together allows for enemy attacks to be disjointed and panicked, causing whiffs. This allows for clean up or more kills than you may get from a one and done angle.",
    },
    {
      id: 5,
      youtubeId: "86yfyE38rXE",
      pauseAt: 5,           // adjust if needed once you know exact pause point
      question: "BONUS: Your gamer instincts have taken over and you are confident they are hitting A without any hard proof. You are going to full commit ultimate. What do you do?",
      correctIndex: 0,      // A is correct
      choices: [
        "Trust your gamer instincts",
        "Get your gun back",
        "Sell your gun to have better economy next round",
        "Play round normally",
      ],
      reason: "Getting rid of self doubt and trusting in yourself can be the difference between a good and a great player. Without this trust you are likely to hesitate in key situations, so committing through the action can be enough to keep this attitude going.",
    },
  ],

  cs2: [
    // cs2 scenarios — swap in real clip IDs when ready
    {
      id: 1,
      youtubeId: "dQw4w9WgXcQ",
      pauseAt: 8,
      question: STANDARD_QUESTION,
      correctIndex: 0,
      choices: ["Say Hi", "Shoot the guy", "Run away", "Do nothing"],
      reason: "Assume friendly unless you're in a PVP lobby.",
    },
  ],

};

// ─── Fallback if gameId doesn't match anything ────────────────────────────────
const FALLBACK_SCENARIOS = [
  {
    id: 1,
    youtubeId: "dQw4w9WgXcQ",
    pauseAt: 8,
    question: STANDARD_QUESTION,
    correctIndex: 0,
    choices: ["Go back and pick a game", "Stay here", "Refresh", "Give up"],
    reason: "No scenarios found for this game. Go back to Category and pick a valid game.",
  },
];

// ─── Load YouTube IFrame API once globally ────────────────────────────────────
let ytApiReady = false;
let ytApiCallbacks = [];

function loadYouTubeApi() {
  if (ytApiReady) return Promise.resolve();
  if (window.YT && window.YT.Player) {
    ytApiReady = true;
    return Promise.resolve();
  }
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

// Grace period (ms) after video ends before auto-advancing to next question.
// Gives users time to read the explanation after the clip finishes.
const POST_VIDEO_GRACE_MS = 5000;

// ─── Instructions Modal ───────────────────────────────────────────────────────
function InstructionsModal({ onClose, isDark }) {
  return (
    <div className="instructions-overlay" onClick={onClose}>
      <div
        className={`instructions-modal ${isDark ? "dark" : "light"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="instructions-close" onClick={onClose} aria-label="Close instructions">
          ✕
        </button>
        <h2 className="instructions-title">How to Play</h2>
        <ol className="instructions-list">
          <li>
            <span className="step-num">1</span>
            <span>Click <strong>▶ Play</strong> on the video — the clip will start playing automatically.</span>
          </li>
          <li>
            <span className="step-num">2</span>
            <span>The video <strong>pauses at a key moment</strong> and the question appears below.</span>
          </li>
          <li>
            <span className="step-num">3</span>
            <span><strong>Select</strong> one of the four options (A, B, C or D) that you think is the correct play.</span>
          </li>
          <li>
            <span className="step-num">4</span>
            <span>Click <strong>Check Answer</strong> to lock in your choice.</span>
          </li>
          <li>
            <span className="step-num">5</span>
            <span>The <strong>answer is revealed</strong> and the video resumes to show the outcome.</span>
          </li>
          <li>
            <span className="step-num">6</span>
            <span>After the clip finishes, the <strong>next question loads automatically</strong>. You can also use the arrows to navigate freely.</span>
          </li>
        </ol>
        <p className="instructions-tip">
          <strong>Tip:</strong> Get the correct answer to earn points on the leaderboard!
        </p>
        <button className="instructions-start-btn" onClick={onClose}>
          Got it — Let's Play!
        </button>
      </div>
    </div>
  );
}

// ─── Video Player with IFrame API ─────────────────────────────────────────────
function YoutubePlayer({ youtubeId, pauseAt, onPaused, onVideoEnded, isSubmitted, scenarioId }) {
  const containerRef = useRef(null);
  const playerRef    = useRef(null);
  const pollRef      = useRef(null);
  const hasPausedRef = useRef(false);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

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

      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (_) {}
        playerRef.current = null;
      }

      hasPausedRef.current = false;
      stopPoll();

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: youtubeId,
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
          start: 0,
        },
        events: {
          onStateChange: (event) => {
            // 1 = playing — start the pause-point poll
            if (event.data === 1 && !hasPausedRef.current) {
              startPoll();
            }
            // 0 = video ended — notify parent so it can schedule next question
            if (event.data === 0) {
              stopPoll();
              if (onVideoEnded) onVideoEnded();
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      stopPoll();
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (_) {}
        playerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId, scenarioId]);

  // Resume video when user submits answer
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QuizCarousel({ user }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { gameId } = useParams();
  const SCENARIOS = SCENARIOS_BY_GAME[gameId] ?? FALLBACK_SCENARIOS;

  const [current, setCurrent]           = useState(0);
  const [selected, setSelected]         = useState(Array(SCENARIOS.length).fill(null));
  const [submitted, setSubmitted]       = useState(Array(SCENARIOS.length).fill(false));
  const [videoPaused, setVideoPaused]   = useState(Array(SCENARIOS.length).fill(false));
  const [sliding, setSliding]           = useState(null);
  const [feedback, setFeedback]         = useState(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showComplete, setShowComplete] = useState(false);

  const touchStartX  = useRef(null);
  const advanceTimer = useRef(null);

  const total         = SCENARIOS.length;
  const scenario      = SCENARIOS[current];
  const isSubmitted   = submitted[current];
  const selectedIdx   = selected[current];
  const isCorrect     = isSubmitted && selectedIdx === scenario.correctIndex;
  const isVideoPaused = videoPaused[current];

  // How many correct across all questions
  const correctCount = submitted.filter(
    (done, i) => done && selected[i] === SCENARIOS[i].correctIndex
  ).length;
  // True once every question has been answered
  const allAnswered = submitted.every(Boolean);

  // ── Mark video as paused for current question ──────────────────────────────
  const handleVideoPaused = useCallback(() => {
    setVideoPaused((prev) => {
      const next = [...prev];
      next[current] = true;
      return next;
    });
  }, [current]);

  // ── Called when the clip finishes playing after the user has answered ───────
  // This is the primary trigger for advancing/completing. The submit fallback
  // timer is cancelled here so only one path fires.
  const handleVideoEnded = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      const updatedSubmitted = submitted.map((s, i) => (i === current ? true : s));
      const allDone = updatedSubmitted.every(Boolean);
      if (allDone && current === total - 1) {
        setShowComplete(true);
      } else {
        goTo("next");
      }
    }, 3000); // 3s after video ends — enough to read explanation without feeling slow
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, submitted, total]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goTo = (direction) => {
    if (sliding) return;
    // Cancel any pending auto-advance when user navigates manually
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    const next = direction === "next"
      ? (current + 1) % total
      : (current - 1 + total) % total;

    setSliding(direction === "next" ? "left" : "right");
    setFeedback(null);
    setTimeout(() => {
      setCurrent(next);
      setSliding(null);
    }, 280);
  };

  // ── Touch / swipe ──────────────────────────────────────────────────────────
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(diff > 0 ? "next" : "prev");
    touchStartX.current = null;
  };

  // ── Answer selection ───────────────────────────────────────────────────────
  const handleSelect = (idx) => {
    if (submitted[current]) return;
    const updated = [...selected];
    updated[current] = idx;
    setSelected(updated);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (selected[current] === null) return;

    const updatedSubmitted = [...submitted];
    updatedSubmitted[current] = true;
    setSubmitted(updatedSubmitted);

    const correct = selected[current] === scenario.correctIndex;
    setFeedback(correct ? "correct" : "wrong");

    if (correct && user?.uid) {
      awardPoints(user.uid, 10).catch((err) => console.error("awardPoints failed:", err));
    }

    // Fallback only — if the video end event never fires (e.g. user skips or
    // YouTube fails to report it), show complete after 60s on the last question.
    // handleVideoEnded is the real trigger and will cancel this if it fires first.
    const willBeAllDone = updatedSubmitted.every(Boolean);
    if (willBeAllDone && current === total - 1) {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        setShowComplete(true);
      }, 60000); // 60s fallback — video end event should fire long before this
    }
  };

  const choiceLabels = ["A", "B", "C", "D"];

  // ── Quiz Complete screen ──────────────────────────────────────────────────
  if (showComplete) {
    const pct     = Math.round((correctCount / total) * 100);
    const perfect = correctCount === total;
    const passing = pct >= 60;

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

            <div className="complete-icon">{perfect ? "★" : passing ? "✓" : "○"}</div>
            <h1 className="complete-title">Quiz Complete!</h1>
            <p className="complete-rank" style={{ color: rank.color }}>{rank.label}</p>

            {/* Score bar */}
            <div className="complete-score-wrap">
              <div className="complete-score-label">
                <span>Your Score</span>
                <span className="complete-fraction">{correctCount} / {total}</span>
              </div>
              <div className="complete-bar-track">
                <div
                  className="complete-bar-fill"
                  style={{ width: `${pct}%`, background: rank.color }}
                />
              </div>
              <div className="complete-pct">{pct}%</div>
            </div>

            {/* Per-question breakdown */}
            <div className="complete-breakdown">
              {SCENARIOS.map((s, i) => {
                const wasCorrect = selected[i] === s.correctIndex;
                return (
                  <div key={i} className={`breakdown-row ${wasCorrect ? "bk-correct" : "bk-wrong"}`}>
                    <span className="bk-num">Q{i + 1}</span>
                    <span className="bk-icon">{wasCorrect ? "✓" : "✗"}</span>
                    <span className="bk-text">
                      {s.question.length > 55 ? s.question.slice(0, 55) + "…" : s.question}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="complete-points">+{correctCount * 10} points earned this quiz</p>

            <div className="complete-actions">
              <button
                className="complete-retry-btn"
                onClick={() => {
                  setShowComplete(false);
                  setCurrent(0);
                  setSelected(Array(SCENARIOS.length).fill(null));
                  setSubmitted(Array(SCENARIOS.length).fill(false));
                  setVideoPaused(Array(SCENARIOS.length).fill(false));
                  setFeedback(null);
                }}
              >
                Try Again
              </button>
              <button
                className="complete-review-btn"
                onClick={() => setShowComplete(false)}
              >
                Review Answers
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getChoiceClass = (idx) => {
    let cls = "choice-btn";
    if (submitted[current]) {
      cls += " locked";
      if (idx === scenario.correctIndex) cls += " correct";
      else if (idx === selected[current]) cls += " wrong";
    } else if (selected[current] === idx) {
      cls += " selected";
    }
    return cls;
  };

  return (
    <div className={`quiz-carousel ${isDark ? "dark" : "light"}`}>

      {/* ── Instructions Modal ────────────────────────────────────────────────── */}
      {showInstructions && (
        <InstructionsModal
          onClose={() => setShowInstructions(false)}
          isDark={isDark}
        />
      )}

      {/* ── Instructions trigger button ──────────────────────────────────────── */}
      <button
        className="how-to-play-btn"
        onClick={() => setShowInstructions(true)}
        title="How to play"
      >
        ? How to Play
      </button>

      {/* ── Progress dots ─────────────────────────────────────────────────────── */}
      <div className="quiz-progress">
        {SCENARIOS.map((_, i) => (
          <span
            key={i}
            className={`dot ${i === current ? "active" : ""} ${submitted[i] ? "done" : ""}`}
          />
        ))}
      </div>

      {/* ── Main slide area ───────────────────────────────────────────────────── */}
      <div
        className={`quiz-slide ${sliding ? `slide-out-${sliding}` : "slide-in"}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        {/* ── Row: left arrow + video + right arrow ─────────────────────────── */}
        <div className="quiz-row">
          <button className="nav-arrow" onClick={() => goTo("prev")} aria-label="Previous question">
            &#9664;
          </button>

          <div className="video-frame">
            <div className="video-label">
              <span className="scenario-counter">{current + 1} / {total}</span>
              {!isVideoPaused && !isSubmitted && (
                <span className="video-hint">▶ Play the clip — it will pause at the key moment</span>
              )}
              {isVideoPaused && !isSubmitted && (
                <span className="video-hint paused">⏸ Paused — pick your answer below</span>
              )}
              {isSubmitted && (
                <span className="video-hint resumed">▶ Resuming to show the outcome…</span>
              )}
            </div>

            <YoutubePlayer
              key={`${scenario.id}-${current}`}
              youtubeId={scenario.youtubeId}
              pauseAt={scenario.pauseAt}
              onPaused={handleVideoPaused}
              onVideoEnded={handleVideoEnded}
              isSubmitted={isSubmitted}
              scenarioId={scenario.id}
            />
          </div>

          <button className="nav-arrow" onClick={() => goTo("next")} aria-label="Next question">
            &#9654;
          </button>
        </div>

        {/* ── Multi-choice panel ────────────────────────────────────────────── */}
        <div className={`quiz-panel ${isVideoPaused || isSubmitted ? "panel-active" : "panel-waiting"}`}>

          {/* Waiting state — before video pauses */}
          {!isVideoPaused && !isSubmitted && (
            <div className="panel-waiting-msg">
              <span className="waiting-icon">[ ]</span>
              <p>Watch the clip — your question will appear here when the video pauses.</p>
            </div>
          )}

          {/* Question + choices — shown after video pauses */}
          {(isVideoPaused || isSubmitted) && (
            <>
              <div className="panel-question">
                <span className="q-badge">Q{current + 1}</span>
                <p>{scenario.question}</p>
              </div>

              <div className="panel-choices">
                {scenario.choices.map((choice, idx) => (
                  <button
                    key={idx}
                    className={getChoiceClass(idx)}
                    onClick={() => handleSelect(idx)}
                    disabled={isSubmitted}
                  >
                    <span className="choice-label">{choiceLabels[idx]}</span>
                    <span className="choice-text">{choice}</span>
                    {isSubmitted && idx === scenario.correctIndex && (
                      <span className="choice-icon">✓</span>
                    )}
                    {isSubmitted && idx === selectedIdx && idx !== scenario.correctIndex && (
                      <span className="choice-icon">✗</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Explanation */}
              {isSubmitted && (
                <div className={`explanation-box ${isCorrect ? "correct" : "wrong"}`}>
                  {isCorrect ? (
                    <p className="explanation-verdict correct">✓ Correct! +10 points</p>
                  ) : (
                    <>
                      <p className="explanation-verdict wrong">✗ Wrong answer!</p>
                      <p className="explanation-chosen">
                        You chose &ldquo;<strong>{scenario.choices[selectedIdx]}</strong>&rdquo;.{" "}
                        The correct play was &ldquo;<strong>{scenario.choices[scenario.correctIndex]}</strong>&rdquo;.
                      </p>
                    </>
                  )}
                  <p className="explanation-reason">
                    <span className="reason-label">Why:</span> {scenario.reason}
                  </p>
                  <p className="explanation-next">
                    ▶ Watch the clip to see the outcome — next question loads in a moment…
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                className={`submit-btn ${isSubmitted ? "submitted" : ""}`}
                onClick={handleSubmit}
                disabled={selectedIdx === null || isSubmitted}
              >
                {isSubmitted ? "✓  Answer Submitted" : "Check Answer — Submit"}
              </button>
            </>
          )}
        </div>

        {/* ── Community Vote ─────────────────────────────────────────────────── */}
        <CommunityVote
          quizId={scenario.id}
          choices={scenario.choices}
          userChoice={selectedIdx}
          correctIndex={scenario.correctIndex}
          isSubmitted={isSubmitted}
        />

        {/* ── Comment Section ────────────────────────────────────────────────── */}
        <CommentSection quizId={scenario.id} />

      </div>
    </div>
  );
}
