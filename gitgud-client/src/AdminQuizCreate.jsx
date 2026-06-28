// AdminQuizCreate.jsx
// Multi-step admin quiz builder for the GitGud platform.
//
// Fixes in this version:
//   1. YouTube URL extraction now handles URLs with extra params (&t=, &list=, etc.)
//   2. Image upload uses quizImages/ storage path (not profileImages/) — all formats accepted
//   3. MultiChoiceEditor and EnterValueEditor now support an optional context image
//   4. RankEditor image upload accepts all image formats (was previously accept="image/*" but
//      the storage rules were blocking — fixed by using correct storage path)

import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import {
  QUESTION_TYPES,
  makeVideoMcQuestion,
  makeMultiChoiceQuestion,
  makeRankQuestion,
  makeEnterValueQuestion,
  validateAdminQuizForm,
} from "./adminQuizUtils";
import "./AdminQuizCreate.css";

// ── Supported games ───────────────────────────────────────────────────────────
const GAMES = [
  { id: "valorant", label: "Valorant" },
  { id: "cs2",      label: "Counter-Strike 2" },
  { id: "fortnite", label: "Fortnite" },
  { id: "other",    label: "Other Games" },
];

const STEPS = ["Details", "Questions", "Review"];

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ text }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="aqc-tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible((v) => !v)}
    >
      <span className="aqc-tooltip-icon">?</span>
      {visible && <span className="aqc-tooltip-box">{text}</span>}
    </span>
  );
}

// ── YouTube helpers ───────────────────────────────────────────────────────────
// FIX: expanded regex to handle URLs with extra query params (&t=, &list=, etc.)
// and also handles youtu.be short links, /shorts/, /live/ and /embed/ paths.
export function extractYouTubeId(url) {
  if (!url) return null;
  const trimmed = String(url).trim();

  const patterns = [
    // Standard watch URL — must be first, catches ?v= with any extra params
    /[?&]v=([A-Za-z0-9_-]{11})/,
    // youtu.be short link
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    // /embed/, /shorts/, /live/ paths
    /youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/,
    // Raw 11-char ID only (no slashes/dots)
    /^([A-Za-z0-9_-]{11})$/,
  ];

  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  return null;
}

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

// ── YouTube API loader ────────────────────────────────────────────────────────
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

function VideoPreview({ videoId }) {
  const divRef = useRef(null);
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
    <div className="aqc-preview-wrap">
      <div
        ref={divRef}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      />
    </div>
  );
}

// ── Cloudinary config ────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET;

// ── Shared image uploader — uses Cloudinary (free tier, no Firebase Storage) ─
function ImageUploader({ imageUrl, onUpload, label = "Upload Image", compact = false }) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  // Keep XHR in a ref so re-renders don't lose or abort it
  const xhrRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPEG, PNG, GIF, WEBP, etc.)");
      return;
    }

    // Abort any in-flight upload before starting a new one
    if (xhrRef.current) {
      try { xhrRef.current.abort(); } catch (_) {}
    }

    setError("");
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "gitgud");

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      xhrRef.current = null;
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          onUpload(data.secure_url);
          setError("");
        } catch (_) {
          setError("Upload failed — invalid response. Please try again.");
        }
      } else {
        // Show the actual Cloudinary error message when available
        let msg = "Upload failed — please try again.";
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData?.error?.message) msg = `Upload failed: ${errData.error.message}`;
        } catch (_) {}
        setError(msg);
      }
      setUploading(false);
      setProgress(0);
    });

    xhr.addEventListener("error", () => {
      xhrRef.current = null;
      setError("Upload failed — check your internet connection.");
      setUploading(false);
    });

    xhr.addEventListener("abort", () => {
      xhrRef.current = null;
      setUploading(false);
    });

    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`
    );
    xhr.send(formData);
  };

  return (
    <div className={`aqc-img-upload-wrap ${compact ? "compact" : ""}`}>
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Question context"
          className={compact ? "aqc-img-thumb" : "aqc-img-preview"}
        />
      )}

      <label className="aqc-img-btn">
        {uploading ? `Uploading ${progress}%...` : imageUrl ? "Change Image" : label}
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
          disabled={uploading}
        />
      </label>

      {uploading && (
        <div className="aqc-upload-bar-wrap">
          <div className="aqc-upload-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {imageUrl && !uploading && (
        <button
          className="aqc-img-remove-btn"
          onClick={() => onUpload("")}
          title="Remove image"
        >
          ✕ Remove
        </button>
      )}

      {error && <p className="aqc-error" style={{ marginTop: 4 }}>{error}</p>}
    </div>
  );
}

// ── Video MC Editor ───────────────────────────────────────────────────────────
function VideoMcEditor({ question, index, onChange, errors }) {
  const prefix = `q${index}`;
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const id = extractYouTubeId(question.ytUrl);
    if (id && id !== question.videoId) {
      // Set videoId immediately so validation passes without waiting for async title fetch.
      // Use functional updater to avoid stale-closure overwriting other fields (e.g. type).
      onChange((q) => ({ ...q, videoId: id, videoTitle: "" }));
      setChecking(true);
      fetchVideoTitle(id).then((t) => {
        onChange((q) => ({ ...q, videoTitle: t ?? "" }));
        setChecking(false);
      });
    } else if (!id && question.videoId) {
      onChange((q) => ({ ...q, videoId: null, videoTitle: "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.ytUrl]);

  return (
    <div className="aqc-qeditor">
      <label className="aqc-label">
        YouTube URL or Video ID
        <Tooltip text="Paste the full YouTube link (including any extra parameters) or the raw 11-character video ID." />
      </label>
      <input
        className={`aqc-input ${errors[`${prefix}_ytUrl`] ? "error" : ""}`}
        placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
        value={question.ytUrl}
        onChange={(e) => { const v = e.target.value; onChange((q) => ({ ...q, ytUrl: v })); }}
      />
      {errors[`${prefix}_ytUrl`] && (
        <p className="aqc-error">{errors[`${prefix}_ytUrl`]}</p>
      )}
      {checking && <p className="aqc-hint">Checking video…</p>}
      {question.videoTitle && !checking && (
        <p className="aqc-hint" style={{ color: "#22c55e" }}>
          ✓ Found: {question.videoTitle}
        </p>
      )}
      {question.videoId && <VideoPreview videoId={question.videoId} />}

      <label className="aqc-label" style={{ marginTop: question.videoId ? 8 : 16 }}>
        Pause Point (seconds)
        <Tooltip text="The video pauses at this second and the question is shown to players." />
      </label>
      <input
        className={`aqc-input aqc-input-sm ${errors[`${prefix}_pauseAt`] ? "error" : ""}`}
        type="number"
        min={1}
        placeholder="e.g. 8"
        value={question.pauseAt}
        onChange={(e) => onChange({ ...question, pauseAt: e.target.value })}
      />
      {errors[`${prefix}_pauseAt`] && (
        <p className="aqc-error">{errors[`${prefix}_pauseAt`]}</p>
      )}

      <label className="aqc-label" style={{ marginTop: 14 }}>
        Question Text
        <Tooltip text="What should players decide at the paused moment?" />
      </label>
      <textarea
        className={`aqc-textarea ${errors[`${prefix}_question`] ? "error" : ""}`}
        rows={2}
        placeholder="e.g. What is the best play here as the entry fragger?"
        value={question.question}
        onChange={(e) => onChange({ ...question, question: e.target.value })}
      />
      {errors[`${prefix}_question`] && (
        <p className="aqc-error">{errors[`${prefix}_question`]}</p>
      )}

      <label className="aqc-label" style={{ marginTop: 14 }}>
        Answer Choices
        <Tooltip text="Provide 4 options. Click a letter to mark the correct one." />
      </label>
      {question.choices.map((choice, ci) => (
        <div key={ci} className="aqc-choice-row">
          <button
            className={`aqc-radio ${question.correctIndex === ci ? "selected" : ""}`}
            onClick={() => onChange({ ...question, correctIndex: ci })}
            title="Mark as correct answer"
          >
            {question.correctIndex === ci ? "✓" : String.fromCharCode(65 + ci)}
          </button>
          <input
            className={`aqc-input aqc-choice-input ${errors[`${prefix}_choices`] ? "error" : ""}`}
            placeholder={`Choice ${String.fromCharCode(65 + ci)}`}
            value={choice}
            onChange={(e) => {
              const updated = [...question.choices];
              updated[ci] = e.target.value;
              onChange({ ...question, choices: updated });
            }}
          />
        </div>
      ))}
      {errors[`${prefix}_choices`] && (
        <p className="aqc-error">{errors[`${prefix}_choices`]}</p>
      )}
      {errors[`${prefix}_correctIndex`] && (
        <p className="aqc-error">{errors[`${prefix}_correctIndex`]}</p>
      )}

      <label className="aqc-label" style={{ marginTop: 14 }}>
        Explanation
        <Tooltip text="Shown after players answer. Explain the correct play." />
      </label>
      <textarea
        className={`aqc-textarea ${errors[`${prefix}_reason`] ? "error" : ""}`}
        rows={2}
        placeholder="Why is the marked answer correct?"
        value={question.reason}
        onChange={(e) => onChange({ ...question, reason: e.target.value })}
      />
      {errors[`${prefix}_reason`] && (
        <p className="aqc-error">{errors[`${prefix}_reason`]}</p>
      )}
    </div>
  );
}

// ── Multi Choice Editor — NEW: optional context image ─────────────────────────
function MultiChoiceEditor({ question, index, onChange, errors }) {
  const prefix = `q${index}`;
  return (
    <div className="aqc-qeditor">

      {/* Optional context image */}
      <label className="aqc-label">
        Context Image <span className="aqc-optional">(optional)</span>
        <Tooltip text="Upload an image to give players visual context — e.g. a screenshot, map, weapon, or item. Shown above the question." />
      </label>
      <ImageUploader
        imageUrl={question.imageUrl ?? ""}
        onUpload={(url) => onChange({ ...question, imageUrl: url })}
        label="Upload Context Image"
        compact={true}
      />

      <label className="aqc-label" style={{ marginTop: 16 }}>
        Question Text
        <Tooltip text="Ask players what the correct play or answer is." />
      </label>
      <textarea
        className={`aqc-textarea ${errors[`${prefix}_question`] ? "error" : ""}`}
        rows={3}
        placeholder="e.g. What is the best play here as the entry fragger?"
        value={question.question}
        onChange={(e) => onChange({ ...question, question: e.target.value })}
      />
      {errors[`${prefix}_question`] && (
        <p className="aqc-error">{errors[`${prefix}_question`]}</p>
      )}

      <label className="aqc-label" style={{ marginTop: 14 }}>
        Answer Choices
        <Tooltip text="Provide 4 options. Mark the correct one by clicking its radio button." />
      </label>
      {question.choices.map((choice, ci) => (
        <div key={ci} className="aqc-choice-row">
          <button
            className={`aqc-radio ${question.correctIndex === ci ? "selected" : ""}`}
            onClick={() => onChange({ ...question, correctIndex: ci })}
            title="Mark as correct answer"
          >
            {question.correctIndex === ci ? "✓" : String.fromCharCode(65 + ci)}
          </button>
          <input
            className={`aqc-input aqc-choice-input ${errors[`${prefix}_choices`] ? "error" : ""}`}
            placeholder={`Choice ${String.fromCharCode(65 + ci)}`}
            value={choice}
            onChange={(e) => {
              const updated = [...question.choices];
              updated[ci] = e.target.value;
              onChange({ ...question, choices: updated });
            }}
          />
        </div>
      ))}
      {errors[`${prefix}_choices`] && (
        <p className="aqc-error">{errors[`${prefix}_choices`]}</p>
      )}
      {errors[`${prefix}_correctIndex`] && (
        <p className="aqc-error">{errors[`${prefix}_correctIndex`]}</p>
      )}

      <label className="aqc-label" style={{ marginTop: 14 }}>
        Explanation
        <Tooltip text="Shown to players after they answer. Explain the reasoning." />
      </label>
      <textarea
        className={`aqc-textarea ${errors[`${prefix}_reason`] ? "error" : ""}`}
        rows={2}
        placeholder="Why is the marked answer correct?"
        value={question.reason}
        onChange={(e) => onChange({ ...question, reason: e.target.value })}
      />
      {errors[`${prefix}_reason`] && (
        <p className="aqc-error">{errors[`${prefix}_reason`]}</p>
      )}
    </div>
  );
}

// ── Rank Editor — FIXED: uses ImageUploader with progress + correct storage path ─
function RankEditor({ question, index, onChange, errors }) {
  const prefix = `q${index}`;

  const correctOrder = question.correctOrder ?? question.items.map((_, i) => i);

  const updateItem = (itemIdx, field, value) => {
    const updated = question.items.map((item, i) =>
      i === itemIdx ? { ...item, [field]: value } : item
    );
    onChange({ ...question, items: updated });
  };

  const dragRef = useRef(null);
  const handleDragStart = (e, pos) => {
    dragRef.current = pos;
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDrop = (e, pos) => {
    e.preventDefault();
    if (dragRef.current === null || dragRef.current === pos) return;
    const updated = [...correctOrder];
    const [moved] = updated.splice(dragRef.current, 1);
    updated.splice(pos, 0, moved);
    onChange({ ...question, correctOrder: updated });
    dragRef.current = null;
  };

  return (
    <div className="aqc-qeditor">

      {/* Optional context / situation image */}
      <label className="aqc-label">
        Context Image <span className="aqc-optional">(optional)</span>
        <Tooltip text="Upload a map screenshot or situation image to give players visual context — shown above the question, just like Multiple Choice." />
      </label>
      <ImageUploader
        imageUrl={question.contextImageUrl ?? ""}
        onUpload={(url) => onChange({ ...question, contextImageUrl: url })}
        label="Upload Context Image"
        compact={true}
      />

      <label className="aqc-label" style={{ marginTop: 16 }}>
        Question Text
        <Tooltip text="Ask players to rank the items you provide." />
      </label>
      <textarea
        className={`aqc-textarea ${errors[`${prefix}_question`] ? "error" : ""}`}
        rows={2}
        placeholder="e.g. Rank these rifles from best to worst."
        value={question.question}
        onChange={(e) => onChange({ ...question, question: e.target.value })}
      />
      {errors[`${prefix}_question`] && (
        <p className="aqc-error">{errors[`${prefix}_question`]}</p>
      )}

      <div className="aqc-toggle-row">
        <label className="aqc-label" style={{ marginBottom: 0 }}>
          Card format
          <Tooltip text="Text: players rank text labels. Image: upload one image per item — accepts JPEG, PNG, GIF, WEBP and more." />
        </label>
        <div
          className="aqc-slide-switch"
          onClick={() => onChange({ ...question, useImages: !question.useImages })}
        >
          <span className={`aqc-slide-option ${!question.useImages ? "active" : ""}`}>Text</span>
          <span className="aqc-slide-divider" />
          <span className={`aqc-slide-option ${question.useImages ? "active" : ""}`}>Image</span>
          <span className={`aqc-slide-thumb ${question.useImages ? "right" : "left"}`} />
        </div>
      </div>

      <label className="aqc-label" style={{ marginTop: 14 }}>
        Items
        <Tooltip text="Add 2-6 items. Drag rows in the correct order section to set the correct ranking." />
      </label>

      {question.items.map((item, itemIdx) => (
        <div key={itemIdx} className="aqc-rank-item-row">
          <span className="aqc-rank-item-num">{itemIdx + 1}</span>
          <input
            className={`aqc-input aqc-rank-label ${errors[`${prefix}_items`] ? "error" : ""}`}
            placeholder={`Item ${itemIdx + 1} label`}
            value={item.label}
            onChange={(e) => updateItem(itemIdx, "label", e.target.value)}
          />
          {question.useImages && (
            <ImageUploader
              imageUrl={item.imageUrl ?? ""}
              onUpload={(url) => updateItem(itemIdx, "imageUrl", url)}
              label="Upload"
              compact
            />
          )}
          {question.useImages && errors[`${prefix}_images`] && !item.imageUrl && (
            <span className="aqc-error-inline">Required</span>
          )}
        </div>
      ))}

      {errors[`${prefix}_items`] && (
        <p className="aqc-error">{errors[`${prefix}_items`]}</p>
      )}
      {errors[`${prefix}_images`] && (
        <p className="aqc-error">{errors[`${prefix}_images`]}</p>
      )}

      <div className="aqc-rank-add-remove">
        {question.items.length < 6 && (
          <button
            className="aqc-btn-sm"
            onClick={() =>
              onChange({
                ...question,
                items: [...question.items, { label: "", imageUrl: "" }],
                correctOrder: [...correctOrder, question.items.length],
              })
            }
          >
            + Add Item
          </button>
        )}
        {question.items.length > 2 && (
          <button
            className="aqc-btn-sm danger"
            onClick={() => {
              const newItems = question.items.slice(0, -1);
              const removed = question.items.length - 1;
              const newOrder = correctOrder
                .filter((i) => i !== removed)
                .map((i) => (i > removed ? i - 1 : i));
              onChange({ ...question, items: newItems, correctOrder: newOrder });
            }}
          >
            - Remove Last
          </button>
        )}
      </div>

      <label className="aqc-label" style={{ marginTop: 18 }}>
        Correct Ranking Order (drag to reorder)
        <Tooltip text="Drag the cards below to set the CORRECT order. Top = 1st place, bottom = last." />
      </label>
      <div className="aqc-correct-order-list">
        {correctOrder.map((itemIdx, pos) => (
          <div
            key={`order-${pos}`}
            className="aqc-order-card"
            draggable
            onDragStart={(e) => handleDragStart(e, pos)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, pos)}
          >
            <span className="aqc-order-rank">{pos + 1}</span>
            {question.useImages && question.items[itemIdx]?.imageUrl && (
              <img
                src={question.items[itemIdx].imageUrl}
                alt=""
                className="aqc-order-thumb"
              />
            )}
            <span className="aqc-order-label">
              {question.items[itemIdx]?.label || `Item ${itemIdx + 1}`}
            </span>
            <span className="aqc-drag-handle">drag</span>
          </div>
        ))}
      </div>
      {errors[`${prefix}_correctOrder`] && (
        <p className="aqc-error">{errors[`${prefix}_correctOrder`]}</p>
      )}

      <label className="aqc-label" style={{ marginTop: 14 }}>
        Explanation
        <Tooltip text="Shown after players submit their ranking. Explain the correct order." />
      </label>
      <textarea
        className={`aqc-textarea ${errors[`${prefix}_reason`] ? "error" : ""}`}
        rows={2}
        placeholder="Why is this the correct ranking?"
        value={question.reason}
        onChange={(e) => onChange({ ...question, reason: e.target.value })}
      />
      {errors[`${prefix}_reason`] && (
        <p className="aqc-error">{errors[`${prefix}_reason`]}</p>
      )}
    </div>
  );
}

// ── Enter Value Editor — NEW: optional context image ──────────────────────────
function EnterValueEditor({ question, index, onChange, errors }) {
  const prefix = `q${index}`;
  return (
    <div className="aqc-qeditor">

      {/* Optional context image */}
      <label className="aqc-label">
        Context Image <span className="aqc-optional">(optional)</span>
        <Tooltip text="Upload a screenshot, item image, or any visual that gives players context for the question." />
      </label>
      <ImageUploader
        imageUrl={question.imageUrl ?? ""}
        onUpload={(url) => onChange({ ...question, imageUrl: url })}
        label="Upload Context Image"
        compact={true}
      />

      <label className="aqc-label" style={{ marginTop: 16 }}>
        Question Text
        <Tooltip text="Ask a question with a specific numeric or text answer." />
      </label>
      <textarea
        className={`aqc-textarea ${errors[`${prefix}_question`] ? "error" : ""}`}
        rows={2}
        placeholder="e.g. How much does the Phantom cost?"
        value={question.question}
        onChange={(e) => onChange({ ...question, question: e.target.value })}
      />
      {errors[`${prefix}_question`] && (
        <p className="aqc-error">{errors[`${prefix}_question`]}</p>
      )}

      <label className="aqc-label" style={{ marginTop: 14 }}>
        Correct Answer
        <Tooltip text="The answer players must type. The system accepts: $4000, 4000, 4,000. Case insensitive." />
      </label>
      <input
        className={`aqc-input ${errors[`${prefix}_correctAnswer`] ? "error" : ""}`}
        placeholder="e.g. $2900 or 4 grenades"
        value={question.correctAnswer}
        onChange={(e) => onChange({ ...question, correctAnswer: e.target.value })}
      />
      {errors[`${prefix}_correctAnswer`] && (
        <p className="aqc-error">{errors[`${prefix}_correctAnswer`]}</p>
      )}
      <p className="aqc-hint">
        Players can answer with "$2900", "2900", "2,900" or "2900 credits" — the number is matched flexibly.
      </p>

      <label className="aqc-label" style={{ marginTop: 14 }}>
        Explanation
        <Tooltip text="Shown after submission. Tell players the correct value and why it matters." />
      </label>
      <textarea
        className={`aqc-textarea ${errors[`${prefix}_reason`] ? "error" : ""}`}
        rows={2}
        placeholder="e.g. The Phantom costs $2900 in Valorant."
        value={question.reason}
        onChange={(e) => onChange({ ...question, reason: e.target.value })}
      />
      {errors[`${prefix}_reason`] && (
        <p className="aqc-error">{errors[`${prefix}_reason`]}</p>
      )}
    </div>
  );
}

// ── Question type labels ──────────────────────────────────────────────────────
const QUESTION_TYPE_META = {
  [QUESTION_TYPES.VIDEO_MC]:     { label: "YouTube Video",   hint: "Embed a clip — pauses at a moment, players choose A B C D" },
  [QUESTION_TYPES.MULTI_CHOICE]: { label: "Multiple Choice", hint: "4 options, one correct answer, optional context image" },
  [QUESTION_TYPES.RANK]:         { label: "Rank the Items",  hint: "Drag cards into the correct order, optional context image + optional images per item" },
  [QUESTION_TYPES.ENTER_VALUE]:  { label: "Enter the Value", hint: "Player types a number or text answer, optional context image" },
};

const QUESTION_EDITORS = {
  [QUESTION_TYPES.VIDEO_MC]:     VideoMcEditor,
  [QUESTION_TYPES.MULTI_CHOICE]: MultiChoiceEditor,
  [QUESTION_TYPES.RANK]:         RankEditor,
  [QUESTION_TYPES.ENTER_VALUE]:  EnterValueEditor,
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminQuizCreate({ user }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [step,        setStep]        = useState(0);
  const [submitting,  setSubmitting]  = useState(false);
  const [done,        setDone]        = useState(false);
  const [errors,      setErrors]      = useState({});
  const [showAddMenu, setShowAddMenu] = useState(false);

  const [title,     setTitle]     = useState("");
  const [game,      setGame]      = useState("valorant");
  const [questions, setQuestions] = useState([makeMultiChoiceQuestion()]);

  const form = { title, game, questions };

  const updateQuestion = (i, updatedOrFn) =>
    setQuestions((prev) =>
      prev.map((q, qi) => {
        if (qi !== i) return q;
        return typeof updatedOrFn === "function" ? updatedOrFn(q) : updatedOrFn;
      })
    );

  const removeQuestion = (i) =>
    setQuestions((prev) => prev.filter((_, qi) => qi !== i));

  const addQuestion = (type) => {
    const factories = {
      [QUESTION_TYPES.VIDEO_MC]:     makeVideoMcQuestion,
      [QUESTION_TYPES.MULTI_CHOICE]: makeMultiChoiceQuestion,
      [QUESTION_TYPES.RANK]:         makeRankQuestion,
      [QUESTION_TYPES.ENTER_VALUE]:  makeEnterValueQuestion,
    };
    setQuestions((prev) => [...prev, factories[type]()]);
    setShowAddMenu(false);
  };

  function next() {
    const errs = validateAdminQuizForm(form);
    const relevantKeys = step === 0
      ? ["title", "game"]
      : Object.keys(errs).filter((k) => k.startsWith("q") || k === "questions");
    const stepErrors = Object.fromEntries(
      Object.entries(errs).filter(([k]) => relevantKeys.some((rk) => k.startsWith(rk)))
    );
    if (Object.keys(stepErrors).length) { setErrors(stepErrors); return; }
    setErrors({});
    setStep((s) => s + 1);
  }

  function back() { setErrors({}); setStep((s) => s - 1); }

  async function handleSubmit() {
    const errs = validateAdminQuizForm(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);

    // Final-pass: resolve any videoId that the useEffect may not have set yet
    const finalQuestions = questions.map((q) => {
      if (q.type !== QUESTION_TYPES.VIDEO_MC) return q;
      const resolvedId = q.videoId || extractYouTubeId(q.ytUrl);
      return resolvedId ? { ...q, videoId: resolvedId } : q;
    });

    try {
      await addDoc(collection(db, "adminQuizzes"), {
        title: title.trim(),
        game,
        questions: finalQuestions,
        createdBy:     user?.uid ?? "admin",
        createdByName: user?.displayName ?? "Admin",
        createdAt:     serverTimestamp(),
        approved:      true,
      });
      setDone(true);
    } catch (err) {
      console.error("Failed to save admin quiz:", err);
      setErrors({ submit: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className={`aqc-page quiz-carousel ${isDark ? "dark" : "light"}`}>
        <div className="aqc-done">
          <div className="aqc-done-icon">✓</div>
          <h2>Quiz Published!</h2>
          <p>
            <strong>{title}</strong> is now live for{" "}
            <strong>{GAMES.find((g) => g.id === game)?.label}</strong>.
          </p>
          <div className="aqc-done-actions">
            <button
              className="aqc-btn-primary"
              onClick={() => navigate(`/admin-quiz/${game}`)}
            >
              View Quizzes
            </button>
            <button
              className="aqc-btn-secondary"
              onClick={() => {
                setDone(false); setStep(0); setTitle("");
                setGame("valorant"); setQuestions([makeMultiChoiceQuestion()]); setErrors({});
              }}
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`aqc-page quiz-carousel ${isDark ? "dark" : "light"}`}>
      <h1 className="aqc-page-title">Create Admin Quiz</h1>

      {/* Step bar */}
      <div className="aqc-stepbar">
        {STEPS.map((label, i) => (
          <div
            key={i}
            className={`aqc-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
          >
            <div className="aqc-step-circle">{i < step ? "✓" : i + 1}</div>
            <div className="aqc-step-label">{label}</div>
            {i < STEPS.length - 1 && <div className="aqc-step-line" />}
          </div>
        ))}
      </div>

      <div className="aqc-card">
        {/* ── Step 0: Details ─────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="aqc-step-content">
            <h2 className="aqc-step-title">Quiz Details</h2>

            <label className="aqc-label">
              Quiz Title
              <Tooltip text="Give this quiz a descriptive name. Players will see this in the dropdown." />
            </label>
            <input
              className={`aqc-input ${errors.title ? "error" : ""}`}
              placeholder="e.g. Valorant Economy Basics"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {errors.title && <p className="aqc-error">{errors.title}</p>}

            <label className="aqc-label" style={{ marginTop: 20 }}>Game</label>
            <div className="aqc-game-btns">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  className={`aqc-game-btn ${game === g.id ? "selected" : ""}`}
                  onClick={() => setGame(g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {errors.game && <p className="aqc-error">{errors.game}</p>}
          </div>
        )}

        {/* ── Step 1: Questions ────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="aqc-step-content">
            <h2 className="aqc-step-title">Questions ({questions.length})</h2>
            {errors.questions && <p className="aqc-error">{errors.questions}</p>}

            {questions.map((q, i) => {
              const Editor = QUESTION_EDITORS[q.type];
              return (
                <div key={i} className="aqc-question-block">
                  <div className="aqc-question-header">
                    <span className="aqc-q-num">Q{i + 1}</span>

                    <div className="aqc-type-switcher">
                      {Object.entries(QUESTION_TYPE_META).map(([type, meta]) => (
                        <button
                          key={type}
                          className={`aqc-type-pill ${q.type === type ? "active" : ""}`}
                          onClick={() => {
                            const factories = {
                              [QUESTION_TYPES.VIDEO_MC]:     makeVideoMcQuestion,
                              [QUESTION_TYPES.MULTI_CHOICE]: makeMultiChoiceQuestion,
                              [QUESTION_TYPES.RANK]:         makeRankQuestion,
                              [QUESTION_TYPES.ENTER_VALUE]:  makeEnterValueQuestion,
                            };
                            const fresh = factories[type]();
                            updateQuestion(i, { ...fresh, question: q.question });
                          }}
                          title={meta.hint}
                        >
                          {meta.label}
                        </button>
                      ))}
                    </div>

                    {questions.length > 1 && (
                      <button className="aqc-remove-q" onClick={() => removeQuestion(i)}>
                        Remove
                      </button>
                    )}
                  </div>

                  {Editor ? (
                    <Editor
                      question={q}
                      index={i}
                      onChange={(updated) => updateQuestion(i, updated)}
                      errors={errors}
                      isAdmin={true}
                    />
                  ) : (
                    <p className="aqc-error">Unknown question type: {q.type}</p>
                  )}
                </div>
              );
            })}

            <div className="aqc-add-q-wrap">
              <button
                className="aqc-add-q-btn"
                onClick={() => setShowAddMenu((v) => !v)}
              >
                + Add Question
              </button>
              {showAddMenu && (
                <div className="aqc-add-menu">
                  {Object.entries(QUESTION_TYPE_META).map(([type, meta]) => (
                    <button
                      key={type}
                      className="aqc-add-menu-item"
                      onClick={() => addQuestion(type)}
                    >
                      <span className="aqc-add-menu-label">{meta.label}</span>
                      <span className="aqc-add-menu-hint">{meta.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Review ───────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="aqc-step-content">
            <h2 className="aqc-step-title">Review and Publish</h2>
            <div className="aqc-review-grid">
              <div className="aqc-review-row">
                <span className="aqc-review-label">Title</span>
                <span className="aqc-review-value">{title}</span>
              </div>
              <div className="aqc-review-row">
                <span className="aqc-review-label">Game</span>
                <span className="aqc-review-value">
                  {GAMES.find((g) => g.id === game)?.label}
                </span>
              </div>
              <div className="aqc-review-row">
                <span className="aqc-review-label">Questions</span>
                <span className="aqc-review-value">{questions.length}</span>
              </div>
              {questions.map((q, i) => (
                <div key={i} className="aqc-review-row">
                  <span className="aqc-review-label">
                    Q{i + 1} ({QUESTION_TYPE_META[q.type]?.label})
                    {(q.imageUrl || q.contextImageUrl) && " 🖼"}
                  </span>
                  <span className="aqc-review-value">
                    {q.question?.length > 60
                      ? q.question.slice(0, 60) + "..."
                      : q.question}
                  </span>
                </div>
              ))}
            </div>
            {errors.submit && (
              <p className="aqc-error" style={{ marginTop: 12 }}>{errors.submit}</p>
            )}
            <p className="aqc-hint" style={{ marginTop: 16 }}>
              Admin quizzes go live immediately. Make sure all questions are accurate.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="aqc-nav">
          {step > 0 && (
            <button className="aqc-btn-secondary" onClick={back} disabled={submitting}>
              Back
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button className="aqc-btn-primary" onClick={next}>
              Next
            </button>
          )}
          {step === STEPS.length - 1 && (
            <button
              className="aqc-btn-primary aqc-btn-publish"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Publishing..." : "Publish Quiz"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
