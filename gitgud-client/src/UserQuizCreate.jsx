// UserQuizCreate.jsx
// Drop into: gitgud-client/src/UserQuizCreate.jsx
//
// INVEST:
//   I – Independent: form can be built and tested without the play page
//   N – Negotiable: number of fake answers, game list can grow
//   V – Valuable: allows users to contribute their own clips to the platform
//   E – Estimable: clear step-by-step form flow
//   S – Small: contained in one component with Firebase write
//   T – Testable: Gherkin tests below
//
// Gherkin:
//   Given the user navigates to /user-quiz/create
//   When the page loads
//   Then a multi-step quiz builder form is displayed
//   And tooltip icons explain each field
//
//   Given the user pastes a YouTube URL
//   When the URL contains a valid YouTube video ID
//   Then the video is embedded as a live preview
//   And if the URL is invalid an error message is shown
//
//   Given the user fills in all required fields and clicks "Finish"
//   When the form is submitted
//   Then a new document is created in Firestore under "userQuizzes"
//   And the document has approved=false (pending moderation)
//   And the user is redirected to the User Quiz page
//
//   Given a video URL is submitted
//   When the video ID is extracted and the YouTube oEmbed endpoint is queried
//   Then the title is fetched and stored
//   And if the video returns no data a warning is shown but submission is not blocked
//
//   Given the user sets pauseAt to a value over 30 seconds
//   When the form validates
//   Then an error message is shown saying the pause point must be within the first 30 seconds
//   (30-second clip limit enforced)

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import "./UserQuizCreate.css";

// ── Supported games ───────────────────────────────────────────────────────────
const GAMES = [
  { id: "valorant", label: "Valorant" },
  { id: "cs2",     label: "Counter-Strike 2" },
  { id: "other",   label: "Other" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/, // raw ID
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Fetch oEmbed title — free, no API key required
async function fetchVideoTitle(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.title ?? null;
  } catch {
    return null;
  }
}

// ── Tooltip component ─────────────────────────────────────────────────────────
function Tooltip({ text }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="uqc-tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible((v) => !v)}
      aria-label={text}
    >
      <span className="uqc-tooltip-icon">?</span>
      {visible && <span className="uqc-tooltip-box">{text}</span>}
    </span>
  );
}

// ── Step indicators ───────────────────────────────────────────────────────────
const STEPS = ["Video", "Question", "Answers", "Game", "Review"];

// ── YouTube IFrame loader (reused from QuizCarousel) ─────────────────────────
let ytApiReady = false;
let ytApiCallbacks = [];
function loadYouTubeApi() {
  if (ytApiReady || (window.YT && window.YT.Player)) {
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

// ── Small video preview ───────────────────────────────────────────────────────
function VideoPreview({ videoId }) {
  const divRef  = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!videoId) return;
    let alive = true;
    loadYouTubeApi().then(() => {
      if (!alive || !divRef.current) return;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (_) {}
      }
      playerRef.current = new window.YT.Player(divRef.current, {
        videoId,
        playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
      });
    });
    return () => {
      alive = false;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (_) {}
        playerRef.current = null;
      }
    };
  }, [videoId]);

  return (
    <div className="uqc-preview-wrap">
      <div ref={divRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UserQuizCreate({ user }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [step,        setStep]        = useState(0);
  const [submitting,  setSubmitting]  = useState(false);
  const [done,        setDone]        = useState(false);
  const [errors,      setErrors]      = useState({});

  // ── Step 0 — Video ──────────────────────────────────────────────────────
  const [ytUrl,       setYtUrl]       = useState("");
  const [videoId,     setVideoId]     = useState(null);
  const [videoTitle,  setVideoTitle]  = useState("");
  const [urlChecking, setUrlChecking] = useState(false);
  const [pauseAt,     setPauseAt]     = useState("");

  // ── Step 1 — Question ───────────────────────────────────────────────────
  const [question,    setQuestion]    = useState("");

  // ── Step 2 — Answers ────────────────────────────────────────────────────
  const [correctAnswer,  setCorrectAnswer]  = useState("");
  const [fakeAnswers,    setFakeAnswers]    = useState(["", "", ""]);
  const [reason,         setReason]         = useState("");

  // ── Step 3 — Game ───────────────────────────────────────────────────────
  const [game,        setGame]        = useState("valorant");

  // ── Step 4 — Review: no extra state ─────────────────────────────────────

  // Resolve videoId whenever ytUrl changes
  useEffect(() => {
    const id = extractYouTubeId(ytUrl.trim());
    if (id) {
      setVideoId(id);
      setErrors((e) => ({ ...e, ytUrl: undefined }));
      setUrlChecking(true);
      fetchVideoTitle(id).then((title) => {
        setVideoTitle(title ?? "");
        setUrlChecking(false);
      });
    } else {
      setVideoId(null);
      setVideoTitle("");
    }
  }, [ytUrl]);

  // ── Validation ────────────────────────────────────────────────────────────
  function validateStep(s) {
    const errs = {};
    if (s === 0) {
      if (!videoId) errs.ytUrl = "Please enter a valid YouTube URL or video ID.";
      const pa = Number(pauseAt);
      if (!pauseAt || isNaN(pa) || pa <= 0) errs.pauseAt = "Enter a positive number of seconds.";
      if (pa > 30) errs.pauseAt = "Pause point must be within the first 30 seconds (30 s clip limit).";
    }
    if (s === 1) {
      if (!question.trim()) errs.question = "Question is required.";
      if (question.trim().length < 10) errs.question = "Question is too short — be more specific.";
    }
    if (s === 2) {
      if (!correctAnswer.trim()) errs.correctAnswer = "Correct answer is required.";
      if (fakeAnswers.some((f) => !f.trim())) errs.fakeAnswers = "All three fake answers are required.";
      if (!reason.trim()) errs.reason = "Please explain why the correct answer is right.";
    }
    if (s === 3) {
      if (!game) errs.game = "Select a game category.";
    }
    return errs;
  }

  function next() {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep((s) => s + 1);
  }
  function back() { setErrors({}); setStep((s) => s - 1); }

  // ── Submit ────────────────────────────────────────────────────────────────
  //
  // Moderation approach (free):
  //   approved=false flags the quiz for admin review before it goes live.
  //   The YouTube oEmbed metadata (title) is stored so an admin can quickly
  //   judge relevance without watching the video. This covers Layer 1 of the
  //   content check described in the brief: if the title obviously doesn't
  //   match the chosen game, an admin can reject it.
  //
  //   Layer 2 / 3 (AI classification, fingerprinting) are paid services —
  //   the free alternative is human moderation via the admin panel (Group 2
  //   of the user stories). The admin dashboard can filter approved=false
  //   documents and approve or delete them.
  async function handleSubmit() {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      // Build shuffled choices: correct answer + 3 fakes, shuffled
      const allChoices = [correctAnswer.trim(), ...fakeAnswers.map((f) => f.trim())];
      // Fisher-Yates shuffle
      for (let i = allChoices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allChoices[i], allChoices[j]] = [allChoices[j], allChoices[i]];
      }
      const correctIndex = allChoices.indexOf(correctAnswer.trim());

      await addDoc(collection(db, "userQuizzes"), {
        videoId,
        videoTitle,      // stored from oEmbed — helps admins judge relevance
        ytUrl: ytUrl.trim(),
        pauseAt: Number(pauseAt),
        question: question.trim(),
        choices: allChoices,
        correctIndex,
        reason: reason.trim(),
        game,
        createdBy: user?.uid ?? "anonymous",
        createdByName: user?.displayName ?? "Anonymous",
        createdAt: serverTimestamp(),
        approved: false,   // ← pending admin moderation (free content check)
        flagged: false,
      });
      setDone(true);
    } catch (err) {
      console.error("Failed to save quiz:", err);
      setErrors({ submit: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className={`uqc-page quiz-carousel ${isDark ? "dark" : "light"}`}>
        <div className="uqc-done">
          <div className="uqc-done-icon">✓</div>
          <h2>Quiz Submitted!</h2>
          <p>
            Your quiz is now <strong>pending review</strong>. Once a moderator approves it,
            it will appear in the User Quizzes section for everyone to play.
          </p>
          <div className="uqc-done-actions">
            <button className="uqc-btn-primary" onClick={() => navigate("/user-quiz")}>
              Back to User Quizzes
            </button>
            <button className="uqc-btn-secondary" onClick={() => { setDone(false); setStep(0); setYtUrl(""); setVideoId(null); setVideoTitle(""); setPauseAt(""); setQuestion(""); setCorrectAnswer(""); setFakeAnswers(["","",""]); setReason(""); setGame("valorant"); }}>
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step renderer ─────────────────────────────────────────────────────────
  return (
    <div className={`uqc-page quiz-carousel ${isDark ? "dark" : "light"}`}>
      {/* Step bar */}
      <div className="uqc-stepbar">
        {STEPS.map((label, i) => (
          <div key={i} className={`uqc-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>
            <div className="uqc-step-circle">{i < step ? "✓" : i + 1}</div>
            <div className="uqc-step-label">{label}</div>
            {i < STEPS.length - 1 && <div className="uqc-step-line" />}
          </div>
        ))}
      </div>

      <div className="uqc-card">
        {/* ── Step 0: Video ─────────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="uqc-step-content">
            <h2 className="uqc-step-title">Step 1 — Add Your Video</h2>

            <label className="uqc-label">
              YouTube Link or Video ID
              <Tooltip text="Paste the full YouTube URL (e.g. https://youtube.com/watch?v=abc123) or just the video ID. The video will be embedded directly — no downloads needed." />
            </label>
            <input
              className={`uqc-input ${errors.ytUrl ? "error" : ""}`}
              placeholder="https://youtube.com/watch?v=..."
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
            />
            {errors.ytUrl && <p className="uqc-error">{errors.ytUrl}</p>}
            {urlChecking && <p className="uqc-hint">Checking video…</p>}
            {videoTitle && !urlChecking && (
              <p className="uqc-hint success">
                ✓ Found: <strong>{videoTitle}</strong>
              </p>
            )}

            {videoId && <VideoPreview videoId={videoId} />}

            <label className="uqc-label" style={{ marginTop: 20 }}>
              Pause Point (seconds)
              <Tooltip text="The video will pause at this second and show the question. Must be 30 seconds or under — keep clips tight and focused. Example: enter 8 to pause at the 8-second mark." />
            </label>
            <input
              className={`uqc-input uqc-input-sm ${errors.pauseAt ? "error" : ""}`}
              type="number"
              min={1}
              max={30}
              placeholder="e.g. 8"
              value={pauseAt}
              onChange={(e) => setPauseAt(e.target.value)}
            />
            {errors.pauseAt && <p className="uqc-error">{errors.pauseAt}</p>}
            <p className="uqc-hint">⏱ Max 30 seconds — keeps quizzes snappy and fair</p>
          </div>
        )}

        {/* ── Step 1: Question ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="uqc-step-content">
            <h2 className="uqc-step-title">Step 2 — Write Your Question</h2>

            <label className="uqc-label">
              Question
              <Tooltip text="Ask players what they should do at the moment the video pauses. Keep it clear and game-specific. Example: 'You have low HP and the spike is planted — what is the best play?'" />
            </label>
            <textarea
              className={`uqc-textarea ${errors.question ? "error" : ""}`}
              rows={4}
              placeholder="e.g. What is the best play here as the entry fragger?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            {errors.question && <p className="uqc-error">{errors.question}</p>}
            <p className="uqc-hint">{question.length} / 300 characters</p>
          </div>
        )}

        {/* ── Step 2: Answers ───────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="uqc-step-content">
            <h2 className="uqc-step-title">Step 3 — Set the Answers</h2>

            <label className="uqc-label">
              Correct Answer
              <Tooltip text="The one right play. Be specific — vague answers like 'shoot' are less useful than 'Peek with blastpack to break their aim'." />
            </label>
            <input
              className={`uqc-input ${errors.correctAnswer ? "error" : ""}`}
              placeholder="e.g. Peek with blastpack"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
            />
            {errors.correctAnswer && <p className="uqc-error">{errors.correctAnswer}</p>}

            <label className="uqc-label" style={{ marginTop: 18 }}>
              Fake Answers (3 required)
              <Tooltip text="Three plausible-but-wrong options. Make them believable so the quiz is challenging — obvious wrong answers make it too easy." />
            </label>
            {fakeAnswers.map((fa, i) => (
              <input
                key={i}
                className={`uqc-input uqc-fake-input ${errors.fakeAnswers ? "error" : ""}`}
                placeholder={`Fake answer ${i + 1}`}
                value={fa}
                onChange={(e) => {
                  const updated = [...fakeAnswers];
                  updated[i] = e.target.value;
                  setFakeAnswers(updated);
                }}
              />
            ))}
            {errors.fakeAnswers && <p className="uqc-error">{errors.fakeAnswers}</p>}

            <label className="uqc-label" style={{ marginTop: 18 }}>
              Why is the correct answer right?
              <Tooltip text="A brief explanation shown after players answer. This is the most valuable part — teach them something. Example: 'Blastpacking disrupts their crosshair placement while they're focused on your teammate.'" />
            </label>
            <textarea
              className={`uqc-textarea ${errors.reason ? "error" : ""}`}
              rows={3}
              placeholder="Explain the game-sense reasoning behind the correct play…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {errors.reason && <p className="uqc-error">{errors.reason}</p>}
          </div>
        )}

        {/* ── Step 3: Game ──────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="uqc-step-content">
            <h2 className="uqc-step-title">Step 4 — Choose Your Game</h2>
            <p className="uqc-hint" style={{ marginBottom: 20 }}>
              This determines which section your quiz appears in. Pick the closest match.
              <Tooltip text="Your quiz will be grouped with other quizzes for this game. If your game isn't listed, select 'Other'." />
            </p>

            <div className="uqc-game-btns">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  className={`uqc-game-btn ${game === g.id ? "selected" : ""}`}
                  onClick={() => setGame(g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {errors.game && <p className="uqc-error">{errors.game}</p>}

            {/* Moderation notice */}
            <div className="uqc-moderation-notice">
              <span className="uqc-mod-icon">🛡️</span>
              <div>
                <strong>Moderation notice</strong>
                <p>
                  All user quizzes are reviewed before going live. Make sure your clip
                  is actually gameplay from the selected game — off-topic, inappropriate,
                  or copyrighted non-gameplay content will be removed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Review ────────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="uqc-step-content">
            <h2 className="uqc-step-title">Step 5 — Review &amp; Finish</h2>

            <div className="uqc-review-grid">
              <div className="uqc-review-row">
                <span className="uqc-review-label">Video</span>
                <span className="uqc-review-value">{videoTitle || videoId}</span>
              </div>
              <div className="uqc-review-row">
                <span className="uqc-review-label">Pause At</span>
                <span className="uqc-review-value">{pauseAt}s</span>
              </div>
              <div className="uqc-review-row">
                <span className="uqc-review-label">Question</span>
                <span className="uqc-review-value">{question}</span>
              </div>
              <div className="uqc-review-row">
                <span className="uqc-review-label">Correct Answer</span>
                <span className="uqc-review-value uqc-review-correct">✓ {correctAnswer}</span>
              </div>
              <div className="uqc-review-row">
                <span className="uqc-review-label">Fake Answers</span>
                <span className="uqc-review-value">
                  {fakeAnswers.map((f, i) => <span key={i} className="uqc-review-fake">✗ {f}</span>)}
                </span>
              </div>
              <div className="uqc-review-row">
                <span className="uqc-review-label">Explanation</span>
                <span className="uqc-review-value">{reason}</span>
              </div>
              <div className="uqc-review-row">
                <span className="uqc-review-label">Game</span>
                <span className="uqc-review-value">{GAMES.find((g) => g.id === game)?.label}</span>
              </div>
            </div>

            {errors.submit && <p className="uqc-error" style={{ marginTop: 16 }}>{errors.submit}</p>}

            <p className="uqc-hint" style={{ marginTop: 16 }}>
              By submitting you agree this is real gameplay footage from the selected game and
              contains no inappropriate or explicit content. False submissions will be removed.
            </p>
          </div>
        )}

        {/* ── Navigation buttons ─────────────────────────────────────────────── */}
        <div className="uqc-nav">
          {step > 0 && (
            <button className="uqc-btn-secondary" onClick={back} disabled={submitting}>
              ← Back
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button className="uqc-btn-primary" onClick={next}>
              Next →
            </button>
          )}
          {step === STEPS.length - 1 && (
            <button className="uqc-btn-primary uqc-btn-finish" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "🎮 Finish & Submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
