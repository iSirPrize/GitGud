// QuizCarousel.jsx
// Drop this file into: gitgud-client/src/components/QuizCarousel.jsx

import { useState, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import "./QuizCarousel.css";

// ─── Quiz data ───────────────────────────────────────────────────────────────
// correctIndex: 0=A, 1=B, 2=C, 3=D
const SCENARIOS = [
  {
    id: 1,
    youtubeId: "dUVqzWhV_rE",
    question: "Question 1 What was the best play in this clip?",
    correctIndex: 0, // A — Say Hi
    choices: ["Say Hi", "Shoot the guy", "run away", "Do nothing"],
    reason: "Assume friendly unless you're in a PVP lobby",
  },
  {
    id: 2,
    youtubeId: "r18j6FWlFb8",
    question: "Question 2 Which decision was the turning point?",
    correctIndex: 0, // A — Tracer
    choices: ["Tracer", "D.Va", "moira", "Reinhard"],
    reason: "She is speed",
  },
  {
    id: 3,
    youtubeId: "PWT2b3nxLOU",
    question: "Question 3 What should the player have done differently?",
    correctIndex: 3, // D — Use everything
    choices: ["Fight unarmed", "Run away", "Let the summon fight", "Use everything"],
    reason: "The Miyazaki way",
  },
  {
    id: 4,
    youtubeId: "uOaSwqlOyxk",
    question: "Question 4 Rate the mechanical skill shown.",
    correctIndex: 1, // B — Ganyu's aim
    choices: ["Barbara's heals", "Ganyu's aim", "Noelle's shields", "Childe's ultimate"],
    reason: "Always aim",
  },
  {
    id: 5,
    youtubeId: "dQw4w9WgXcQ",
    question: "Question 5 What was the biggest mistake made?",
    correctIndex: 2, // C — You have made a grave error
    choices: ["Why this video", "This video is great", "You have made a grave error", "In before 6-7"],
    reason: "You have been Rick rolled",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function QuizCarousel() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(Array(SCENARIOS.length).fill(null));
  const [submitted, setSubmitted] = useState(Array(SCENARIOS.length).fill(false));
  const [sliding, setSliding] = useState(null); // "left" | "right" | null
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null

  const touchStartX = useRef(null);

  const total = SCENARIOS.length;
  const scenario = SCENARIOS[current];
  const isSubmitted = submitted[current];
  const selectedIdx = selected[current];
  const isCorrect = isSubmitted && selectedIdx === scenario.correctIndex;
  const isWrong = isSubmitted && selectedIdx !== scenario.correctIndex;

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

    // ── Backend hook ─────────────────────────────────────────────────────────
    // When the backend is ready, your teammate can uncomment and wire this up:
    //
    // try {
    //   await fetch("http://localhost:3001/api/votes", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
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
            {isSubmitted ? "✓  Answer Submitted" : "Submit Answer"}
          </button>

        </div>
      </div>
    </div>
  );
}
