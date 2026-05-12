// CritiqueCreate.jsx
// Drop into: gitgud-client/src/CritiqueCreate.jsx
//
// Gherkin:
//   Given the user navigates to /critique/create
//   When the page loads
//   Then a form is shown with: YouTube URL input, title, category selector, submit button
//   And each field has a tooltip explaining what to enter
//
//   Given the user pastes a YouTube URL
//   When a valid video ID is detected
//   Then the video is embedded as a live preview
//   And the oEmbed API fetches and displays the video title
//
//   Given all fields are filled in correctly
//   When the user clicks Submit
//   Then a new document is created in Firestore under "critiquePosts" with approved: false
//   And the user is redirected to /critique
//
//   Given the YouTube URL is invalid
//   When the user tries to submit
//   Then an error message is shown and the form is not submitted

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import { CRITIQUE_CATEGORIES } from "./CritiquePage";
import "./CritiqueCreate.css";

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Free oEmbed — no API key required
async function fetchOEmbed(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title ?? null, authorName: data.author_name ?? null };
  } catch {
    return null;
  }
}

// ── YouTube IFrame loader ─────────────────────────────────────────────────────
let ytApiReady = false;
let ytCbs = [];
function loadYT() {
  if (ytApiReady || (window.YT && window.YT.Player)) { ytApiReady = true; return Promise.resolve(); }
  return new Promise((res) => {
    ytCbs.push(res);
    if (!document.getElementById("yt-iframe-api")) {
      const t = document.createElement("script");
      t.id  = "yt-iframe-api";
      t.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(t);
      window.onYouTubeIframeAPIReady = () => {
        ytApiReady = true; ytCbs.forEach((cb) => cb()); ytCbs = [];
      };
    }
  });
}

function VideoPreview({ videoId }) {
  const divRef = useRef(null);
  const playerRef = useRef(null);
  useEffect(() => {
    if (!videoId) return;
    let alive = true;
    loadYT().then(() => {
      if (!alive || !divRef.current) return;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (_) {} }
      playerRef.current = new window.YT.Player(divRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
      });
    });
    return () => {
      alive = false;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (_) {} playerRef.current = null; }
    };
  }, [videoId]);
  return (
    <div className="cc-preview-wrap">
      <div ref={divRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}

function Tooltip({ text }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="cc-tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible((v) => !v)}
    >
      <span className="cc-tooltip-icon">?</span>
      {visible && <span className="cc-tooltip-box">{text}</span>}
    </span>
  );
}

// Filter categories — remove "All Posts" from form options
const FORM_CATEGORIES = CRITIQUE_CATEGORIES.filter((c) => c.id !== "all");

export default function CritiqueCreate({ user }) {
  const { theme }  = useTheme();
  const isDark     = theme === "dark";
  const navigate   = useNavigate();

  const [ytUrl,       setYtUrl]       = useState("");
  const [videoId,     setVideoId]     = useState(null);
  const [videoTitle,  setVideoTitle]  = useState("");
  const [checking,    setChecking]    = useState(false);
  const [title,       setTitle]       = useState("");
  const [category,    setCategory]    = useState("wrong");
  const [submitting,  setSubmitting]  = useState(false);
  const [done,        setDone]        = useState(false);
  const [errors,      setErrors]      = useState({});

  // Resolve video ID and fetch oEmbed title on URL change
  useEffect(() => {
    const id = extractYouTubeId(ytUrl.trim());
    if (id) {
      setVideoId(id);
      setErrors((e) => ({ ...e, ytUrl: undefined }));
      setChecking(true);
      fetchOEmbed(id).then((data) => {
        setVideoTitle(data?.title ?? "");
        setChecking(false);
      });
    } else {
      setVideoId(null);
      setVideoTitle("");
    }
  }, [ytUrl]);

  function validate() {
    const errs = {};
    if (!videoId)          errs.ytUrl    = "Enter a valid YouTube URL or video ID.";
    if (!title.trim())     errs.title    = "Give your post a title.";
    if (title.length > 120) errs.title   = "Title must be 120 characters or fewer.";
    if (!category)         errs.category = "Select a category.";
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "critiquePosts"), {
        videoId,
        videoTitle,           // oEmbed title stored for admin review
        ytUrl:       ytUrl.trim(),
        title:       title.trim(),
        category,
        creatorId:   user?.uid   ?? "anonymous",
        creatorName: user?.displayName ?? "Anonymous",
        createdAt:   serverTimestamp(),
        likes:       [],
        dislikes:    [],
        approved:    false,   // pending admin moderation
        flagged:     false,
      });
      setDone(true);
    } catch (err) {
      console.error("Submit failed:", err);
      setErrors({ submit: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // Done screen
  if (done) {
    return (
      <div className={`cc-page quiz-carousel ${isDark ? "dark" : "light"}`}>
        <div className="cc-done">
          <div className="cc-done-icon">✓</div>
          <h2>Clip Submitted!</h2>
          <p>
            Your clip is <strong>pending review</strong>. Once a moderator approves it,
            it will appear in the User Critique feed.
          </p>
          <div className="cc-done-actions">
            <button className="cc-btn-primary" onClick={() => navigate("/critique")}>
              Back to Critique Feed
            </button>
            <button className="cc-btn-secondary" onClick={() => {
              setDone(false); setYtUrl(""); setVideoId(null);
              setVideoTitle(""); setTitle(""); setCategory("wrong"); setErrors({});
            }}>
              Post Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`cc-page quiz-carousel ${isDark ? "dark" : "light"}`}>
      <div className="cc-header">
        <h1 className="cc-title">Post a Clip</h1>
        <p className="cc-subtitle">Share your gameplay and get honest feedback from the community</p>
        <div className="cc-underline" />
      </div>

      <div className="cc-card">

        {/* YouTube URL */}
        <label className="cc-label">
          YouTube Link
          <Tooltip text="Paste the full YouTube URL of your clip (e.g. https://youtube.com/watch?v=abc123). The video must be public or unlisted. It will be embedded directly in the feed." />
        </label>
        <input
          className={`cc-input ${errors.ytUrl ? "error" : ""}`}
          placeholder="https://youtube.com/watch?v=..."
          value={ytUrl}
          onChange={(e) => setYtUrl(e.target.value)}
        />
        {errors.ytUrl   && <p className="cc-error">{errors.ytUrl}</p>}
        {checking       && <p className="cc-hint">Checking video…</p>}
        {videoTitle && !checking && (
          <p className="cc-hint success">Found: <strong>{videoTitle}</strong></p>
        )}

        {videoId && <VideoPreview videoId={videoId} />}

        {/* Post title */}
        <label className="cc-label" style={{ marginTop: 20 }}>
          Post Title
          <Tooltip text="Describe what you want feedback on. Be specific. Examples: 'Why did I lose this 1v1?' or 'Was this the right call to push?' or 'Sick clutch on Ascent round 24'." />
        </label>
        <input
          className={`cc-input ${errors.title ? "error" : ""}`}
          placeholder="e.g. What did I do wrong in this 1v1?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
        {errors.title && <p className="cc-error">{errors.title}</p>}
        <p className="cc-hint">{title.length} / 120</p>

        {/* Category */}
        <label className="cc-label" style={{ marginTop: 16 }}>
          Category
          <Tooltip text="Choose the type of feedback you are looking for. 'What am I doing wrong?' means you want improvement advice. 'Check this play out' means you want reactions to a good moment." />
        </label>
        <div className="cc-category-btns">
          {FORM_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`cc-cat-btn ${category === cat.id ? "selected" : ""}`}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {errors.category && <p className="cc-error">{errors.category}</p>}

        {/* Moderation notice */}
        <div className="cc-mod-notice">
          <strong>Moderation notice</strong>
          <p>
            All clips are reviewed before going live. Make sure your video is actual gameplay.
            Off-topic, inappropriate, or explicit content will be removed.
          </p>
        </div>

        {errors.submit && <p className="cc-error" style={{ marginTop: 12 }}>{errors.submit}</p>}

        {/* Submit */}
        <div className="cc-actions">
          <button className="cc-btn-secondary" onClick={() => navigate("/critique")}>
            Cancel
          </button>
          <button
            className="cc-btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit Clip"}
          </button>
        </div>
      </div>
    </div>
  );
}
