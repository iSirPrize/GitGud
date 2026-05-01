// CommunityVote.jsx
// Place this file at: gitgud-client/src/components/CommunityVote.jsx
//
// Shows a real-time community vote breakdown bubble after the user submits.
// Uses Firebase Firestore onSnapshot — 100% free tier, no backend needed.
//
// Props:
//   quizId        {number}  — matches scenario.id from QuizCarousel
//   choices       {string[]}— the A/B/C/D option labels
//   userChoice    {number|null} — index of what THIS user picked (null = not voted)
//   correctIndex  {number}  — index of the correct answer
//   isSubmitted   {boolean} — only show after the user has answered

import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
  doc,
  setDoc,
  onSnapshot,
  increment,
} from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import "./CommunityVote.css";

const LABELS = ["A", "B", "C", "D"];

export default function CommunityVote({
  quizId,
  choices,
  userChoice,
  correctIndex,
  isSubmitted,
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [voteCounts, setVoteCounts] = useState(null);

  // Use a ref to track whether we've recorded for THIS quizId in this session.
  // A ref avoids the stale-closure problem that caused Q2–5 to skip recording —
  // unlike useState, changing a ref does NOT trigger a re-render, and its value
  // is always current inside async callbacks.
  const recordedForRef = useRef(new Set());

  const storageKey = `cv_voted_quiz_${quizId}`;

  // Path: communityVotes / quiz_{id}
  const docRef = doc(db, "communityVotes", `quiz_${quizId}`);

  // ── Real-time listener ────────────────────────────────────────────────────
  // Re-subscribes whenever quizId changes so each question gets its own stream.
  useEffect(() => {
    if (!isSubmitted) return;

    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setVoteCounts(snap.data());
      } else {
        setVoteCounts({ 0: 0, 1: 0, 2: 0, 3: 0 });
      }
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitted, quizId]);

  // ── Record this user's vote (once per quizId per browser session) ─────────
  useEffect(() => {
    if (!isSubmitted || userChoice === null) return;

    // Already recorded for this quizId this session or this page load
    if (recordedForRef.current.has(quizId)) return;
    if (localStorage.getItem(storageKey) === "1") return;

    const recordVote = async () => {
      try {
        // setDoc with merge:true safely creates the doc if missing OR merges
        // into an existing one — no race condition between getDoc + updateDoc.
        await setDoc(
          docRef,
          { [String(userChoice)]: increment(1) },
          { merge: true }
        );
        localStorage.setItem(storageKey, "1");
        recordedForRef.current.add(quizId);
      } catch (err) {
        console.error("CommunityVote: failed to record vote", err);
      }
    };

    recordVote();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitted, userChoice, quizId]);

  // ── Don't render until the user has submitted ─────────────────────────────
  if (!isSubmitted) return null;

  // ── Derived stats ─────────────────────────────────────────────────────────
  const counts = voteCounts ?? { 0: 0, 1: 0, 2: 0, 3: 0 };
  const total = Object.values(counts).reduce((s, v) => s + (Number(v) || 0), 0);

  const getPct = (idx) => {
    const c = Number(counts[idx]) || 0;
    return total === 0 ? 0 : Math.round((c / total) * 100);
  };

  return (
    <div className={`cv-bubble ${isDark ? "cv-dark" : "cv-light"}`}>
      <div className="cv-header">
        <span className="cv-icon">📊</span>
        <span className="cv-title">Community Vote</span>
        <span className="cv-total">
          {total === 0 ? "No votes yet" : `${total} vote${total !== 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="cv-bars">
        {choices.map((choice, idx) => {
          const pct       = getPct(idx);
          const count     = Number(counts[idx]) || 0;
          const isUser    = idx === userChoice;
          const isCorrect = idx === correctIndex;

          let barClass = "cv-bar-fill";
          if (isCorrect) barClass += " cv-correct";
          else if (isUser && !isCorrect) barClass += " cv-wrong";

          return (
            <div key={idx} className={`cv-row ${isUser ? "cv-user-row" : ""}`}>
              {/* Label badge */}
              <span className={`cv-label ${isCorrect ? "cv-label-correct" : ""}`}>
                {LABELS[idx]}
              </span>

              {/* Choice text */}
              <span className="cv-choice-text" title={choice}>
                {choice}
                {isUser && <span className="cv-you-badge"> (you)</span>}
              </span>

              {/* Bar track + fill */}
              <div className="cv-bar-track">
                <div className={barClass} style={{ width: `${pct}%` }} />
              </div>

              {/* Count + percentage */}
              <span className="cv-stat">
                {count} <span className="cv-pct">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>

      {total === 0 && (
        <p className="cv-empty">Be the first to vote!</p>
      )}
    </div>
  );
}
