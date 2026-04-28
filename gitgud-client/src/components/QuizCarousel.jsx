// QuizCarousel.jsx
// Drop this file into: gitgud-client/src/components/QuizCarousel.jsx
//
// Sprint 2 changes:
//   1. Reads gameId from URL params (/quiz/:gameId) to load game-specific scenarios
//   2. All questions standardised to "What is the play here?"
//   3. Separate scenario lists for each game category (valorant, cs2)
//   4. Placeholder YouTube links kept — swap in real clip IDs when videos are ready

import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import CommentSection from "./CommentSection";
import CommunityVote from "./CommunityVote";
import "./QuizCarousel.css";
import { awardPoints } from "../usePoints";

// ─── Standard question used across ALL games ──────────────────────────────────
const STANDARD_QUESTION = "What is the play here?";

// ─── Scenario banks per game ──────────────────────────────────────────────────
// To add a new game: add a new key matching the id in Category.jsx
// To swap in real clips: replace the youtubeId value with the real YouTube video ID
// YouTube ID is the part after "?v=" e.g. youtube.com/watch?v=dUVqzWhV_rE → "dUVqzWhV_rE"

const SCENARIOS_BY_GAME = {

  valorant: [
    {
      id: 1,
      youtubeId: "dUVqzWhV_rE", // placeholder — swap with real Valorant clip ID
      question: STANDARD_QUESTION,
      correctIndex: 0,
      choices: ["Say Hi", "Shoot the guy", "Run away", "Do nothing"],
      reason: "Assume friendly unless you're in a PVP lobby",
    },
    {
      id: 2,
      youtubeId: "r18j6FWlFb8", // placeholder — swap with real Valorant clip ID
      question: STANDARD_QUESTION,
      correctIndex: 0,
      choices: ["Tracer", "D.Va", "Moira", "Reinhard"],
      reason: "She is speed",
    },
    {
      id: 3,
      youtubeId: "PWT2b3nxLOU", // placeholder — swap with real Valorant clip ID
      question: STANDARD_QUESTION,
      correctIndex: 3,
      choices: ["Fight unarmed", "Run away", "Let the summon fight", "Use everything"],
      reason: "The Miyazaki way",
    },
    {
      id: 4,
      youtubeId: "uOaSwqlOyxk", // placeholder — swap with real Valorant clip ID
      question: STANDARD_QUESTION,
      correctIndex: 1,
      choices: ["Barbara's heals", "Ganyu's aim", "Noelle's shields", "Childe's ultimate"],
      reason: "Always aim",
    },
    {
      id: 5,
      youtubeId: "dQw4w9WgXcQ", // placeholder — swap with real Valorant clip ID
      question: STANDARD_QUESTION,
      correctIndex: 2,
      choices: ["Why this video", "This video is great", "You have made a grave error", "In before 6-7"],
      reason: "You have been Rick rolled",
    },
  ],

  cs2: [
    {
      id: 1,
      youtubeId: "dUVqzWhV_rE", // placeholder — swap with real CS2 clip ID
      question: STANDARD_QUESTION,
      correctIndex: 0,
      choices: ["Say Hi", "Shoot the guy", "Run away", "Do nothing"],
      reason: "Assume friendly unless you're in a PVP lobby",
    },
    {
      id: 2,
      youtubeId: "r18j6FWlFb8", // placeholder — swap with real CS2 clip ID
      question: STANDARD_QUESTION,
      correctIndex: 0,
      choices: ["Tracer", "D.Va", "Moira", "Reinhard"],
      reason: "She is speed",
    },
    {
      id: 3,
      youtubeId: "PWT2b3nxLOU", // placeholder — swap with real CS2 clip ID
      question: STANDARD_QUESTION,
      correctIndex: 3,
      choices: ["Fight unarmed", "Run away", "Let the summon fight", "Use everything"],
      reason: "The Miyazaki way",
    },
    {
      id: 4,
      youtubeId: "uOaSwqlOyxk", // placeholder — swap with real CS2 clip ID
      question: STANDARD_QUESTION,
      correctIndex: 1,
      choices: ["Barbara's heals", "Ganyu's aim", "Noelle's shields", "Childe's ultimate"],
      reason: "Always aim",
    },
    {
      id: 5,
      youtubeId: "dQw4w9WgXcQ", // placeholder — swap with real CS2 clip ID
      question: STANDARD_QUESTION,
      correctIndex: 2,
      choices: ["Why this video", "This video is great", "You have made a grave error", "In before 6-7"],
      reason: "You have been Rick rolled",
    },
  ],

};

// ─── Fallback if gameId doesn't match anything ────────────────────────────────
const FALLBACK_SCENARIOS = [
  {
    id: 1,
    youtubeId: "dQw4w9WgXcQ",
    question: STANDARD_QUESTION,
    correctIndex: 0,
    choices: ["Go back and pick a game", "Stay here", "Refresh", "Give up"],
    reason: "No scenarios found for this game. Go back to Category and pick a valid game.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function QuizCarousel({ user }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Read gameId from URL — e.g. /quiz/valorant gives gameId = "valorant"
  const { gameId } = useParams();

  // Pick the right scenario list based on the game, fall back if unknown
  const SCENARIOS = SCENARIOS_BY_GAME[gameId] ?? FALLBACK_SCENARIOS;

  const [current, setCurrent]     = useState(0);
  const [selected, setSelected]   = useState(Array(SCENARIOS.length).fill(null));
  const [submitted, setSubmitted] = useState(Array(SCENARIOS.length).fill(false));
  const [sliding, setSliding]     = useState(null); // "left" | "right" | null
  const [feedback, setFeedback]   = useState(null); // "correct" | "wrong" | null

  const touchStartX = useRef(null);

  const total       = SCENARIOS.length;
  const scenario    = SCENARIOS[current];
  const isSubmitted = submitted[current];
  const selectedIdx = selected[current];
  const isCorrect   = isSubmitted && selectedIdx === scenario.correctIndex;

  // ── Navigation with slide animation ─────────────────────────────────────────
  const goTo = (direction) => {
    if (sliding) return;
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

  // ── Touch / swipe support ────────────────────────────────────────────────────
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      goTo(diff > 0 ? "next" : "prev");
    }
    touchStartX.current = null;
  };

  // ── Answer selection ─────────────────────────────────────────────────────────
  const handleSelect = (idx) => {
    if (submitted[current]) return;
    const updated = [...selected];
    updated[current] = idx;
    setSelected(updated);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (selected[current] === null) return;

    const updatedSubmitted = [...submitted];
    updatedSubmitted[current] = true;
    setSubmitted(updatedSubmitted);

    const correct = selected[current] === scenario.correctIndex;
    setFeedback(correct ? "correct" : "wrong");

    if (correct && user?.uid) {
      awardPoints(user.uid, 10).catch(err => console.error("awardPoints failed:", err));
    }

    // ── Backend hook ─────────────────────────────────────────────────────────
    // When the backend is ready, uncomment and wire this up:
    //
    // try {
    //   await fetch("http://localhost:3001/api/votes", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       gameId,
    //       scenarioId: scenario.id,
    //       choiceIndex: selected[current],
    //       correct,
    //     }),
    //   });
    // } catch (err) {
    //   console.error("Vote submission failed:", err);
    // }

    // Auto-advance after showing explanation
    setTimeout(() => {
      goTo("next");
    }, 3000);
  };

  const choiceLabels = ["A", "B", "C", "D"];

  // ── Choice button class helper ───────────────────────────────────────────────
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

      {/* ── Progress dots ───────────────────────────────────────────────────── */}
      <div className="quiz-progress">
        {SCENARIOS.map((_, i) => (
          <span
            key={i}
            className={`dot ${i === current ? "active" : ""} ${submitted[i] ? "done" : ""}`}
          />
        ))}
      </div>

      {/* ── Main slide area ──────────────────────────────────────────────────── */}
      <div
        className={`quiz-slide ${sliding ? `slide-out-${sliding}` : "slide-in"}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        {/* ── Row: left arrow + video window + right arrow ──────────────────── */}
        <div className="quiz-row">
          <button
            className="nav-arrow"
            onClick={() => goTo("prev")}
            aria-label="Previous question"
          >
            &#9664;
          </button>

          {/* Video window */}
          <div className="video-frame">
            <div className="video-label">
              <span className="scenario-counter">
                {current + 1} / {total}
              </span>
            </div>
            <div className="video-wrapper">
              <iframe
                key={scenario.id}
                src={`https://www.youtube.com/embed/${scenario.youtubeId}`}
                title={`Scenario ${scenario.id}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>

          <button
            className="nav-arrow"
            onClick={() => goTo("next")}
            aria-label="Next question"
          >
            &#9654;
          </button>
        </div>

        {/* ── Multi-choice panel ────────────────────────────────────────────── */}
        <div className="quiz-panel">

          {/* Question */}
          <div className="panel-question">
            <span className="q-badge">Q{current + 1}</span>
            <p>{scenario.question}</p>
          </div>

          {/* Choices */}
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

          {/* ── Explanation (shown after submit) ────────────────────────────── */}
          {isSubmitted && (
            <div className={`explanation-box ${isCorrect ? "correct" : "wrong"}`}>
              {isCorrect ? (
                <p className="explanation-verdict correct">✓ Correct!</p>
              ) : (
                <>
                  <p className="explanation-verdict wrong">✗ Wrong answer!</p>
                  <p className="explanation-chosen">
                    You chose &ldquo;<strong>{scenario.choices[selectedIdx]}</strong>&rdquo;.{" "}
                    The answer is &ldquo;<strong>{scenario.choices[scenario.correctIndex]}</strong>&rdquo;.
                  </p>
                </>
              )}
              <p className="explanation-reason">
                <span className="reason-label">Reason why:</span> {scenario.reason}
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

        </div>

        {/* ── Community Vote Bubble ─────────────────────────────────────────── */}
        {/* quizId uses scenario.id so votes are isolated per game + clip        */}
        <CommunityVote
          quizId={scenario.id}
          choices={scenario.choices}
          userChoice={selectedIdx}
          correctIndex={scenario.correctIndex}
          isSubmitted={isSubmitted}
        />

        {/* ── Comment Section ───────────────────────────────────────────────── */}
        {/* quizId uses scenario.id so each game's clips have their own comments */}
        <CommentSection quizId={scenario.id} />

      </div>
    </div>
  );
}
