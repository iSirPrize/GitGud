// CritiquePost.jsx
// Drop into: gitgud-client/src/CritiquePost.jsx

import { useState, useRef, useEffect } from "react";
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import CommentSection from "./components/CommentSection";
import { extractYouTubeId, buildEmbedUrl } from "./critiqueUtils";
import "./CritiquePost.css";

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

function EmbeddedPlayer({ videoId }) {
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
    <div className="cp-video-wrap">
      <div ref={divRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}

const CATEGORY_LABELS = {
  wrong:     "What am I doing wrong?",
  highlight: "Check this play out",
};

const CATEGORIES = [
  { id: "wrong",     label: "What am I doing wrong?" },
  { id: "highlight", label: "Check this play out" },
];

// ── Inline edit form ──────────────────────────────────────────────────────────
function EditForm({ post, onSave, onCancel, saving }) {
  const [title,    setTitle]    = useState(post.title    ?? "");
  const [ytUrl,    setYtUrl]    = useState(post.ytUrl    ?? "");
  const [category, setCategory] = useState(post.category ?? "wrong");
  const [error,    setError]    = useState("");

  const handleSave = () => {
    if (!title.trim())          { setError("Title is required.");              return; }
    if (title.trim().length > 120) { setError("Title must be 120 chars or fewer."); return; }
    const videoId = extractYouTubeId(ytUrl);
    if (!videoId)               { setError("Enter a valid YouTube URL or ID."); return; }
    setError("");
    onSave({ title: title.trim(), ytUrl: ytUrl.trim(), videoId, category });
  };

  return (
    <div className="cpost-edit-form">
      <p className="cpost-edit-heading">Edit Clip</p>

      <label className="cpost-edit-label">Title</label>
      <input
        className="cpost-edit-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Post title"
        maxLength={120}
      />

      <label className="cpost-edit-label">YouTube URL / ID</label>
      <input
        className="cpost-edit-input"
        value={ytUrl}
        onChange={(e) => setYtUrl(e.target.value)}
        placeholder="https://youtube.com/watch?v=..."
      />

      <label className="cpost-edit-label">Category</label>
      <select
        className="cpost-edit-select"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </select>

      {error && <p className="cpost-edit-error">{error}</p>}

      <div className="cpost-edit-actions">
        <button
          className="cpost-edit-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          className="cpost-edit-cancel"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CritiquePost({ post, user, isAdmin = false, onDeleted }) {
  const { theme } = useTheme();
  const isDark    = theme === "dark";

  const [likes,        setLikes]        = useState(post.likes    ?? []);
  const [dislikes,     setDislikes]     = useState(post.dislikes ?? []);
  const [acting,       setActing]       = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [creatorName,  setCreatorName]  = useState(post.creatorName ?? "");

  // Edit / delete state
  const [isEditing,  setIsEditing]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [localPost,  setLocalPost]  = useState(post);   // reflects saved edits locally
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const uid       = user?.uid;
  const isOwner   = uid && uid === localPost.creatorId;
  const canEdit   = isOwner || isAdmin;

  const hasLiked    = uid ? likes.includes(uid)    : false;
  const hasDisliked = uid ? dislikes.includes(uid) : false;

  // Fetch fresh creator name if not stored on the doc
  useEffect(() => {
    if (localPost.creatorId && !localPost.creatorName) {
      getDoc(doc(db, "users", localPost.creatorId))
        .then((s) => { if (s.exists()) setCreatorName(s.data().username ?? ""); })
        .catch(() => {});
    }
  }, [localPost.creatorId, localPost.creatorName]);

  // ── Reactions ──────────────────────────────────────────────────────────────
  const handleReaction = async (type) => {
    if (!uid || acting) return;
    setActing(true);
    try {
      const ref = doc(db, "critiquePosts", localPost.id);
      if (type === "like") {
        if (hasLiked) {
          await updateDoc(ref, { likes: arrayRemove(uid) });
          setLikes((p) => p.filter((id) => id !== uid));
        } else {
          await updateDoc(ref, { likes: arrayUnion(uid), dislikes: arrayRemove(uid) });
          setLikes((p) => [...p, uid]);
          setDislikes((p) => p.filter((id) => id !== uid));
        }
      } else {
        if (hasDisliked) {
          await updateDoc(ref, { dislikes: arrayRemove(uid) });
          setDislikes((p) => p.filter((id) => id !== uid));
        } else {
          await updateDoc(ref, { dislikes: arrayUnion(uid), likes: arrayRemove(uid) });
          setDislikes((p) => [...p, uid]);
          setLikes((p) => p.filter((id) => id !== uid));
        }
      }
    } catch (err) {
      console.error("Reaction failed:", err);
    } finally {
      setActing(false);
    }
  };

  // ── Save edit ──────────────────────────────────────────────────────────────
  const handleSave = async ({ title, ytUrl, videoId, category }) => {
    setSaving(true);
    try {
      const updates = { title, ytUrl, videoId, category };
      // If the clip was previously approved and the video changes,
      // send it back to pending so an admin can re-review.
      if (videoId !== localPost.videoId && localPost.approved) {
        updates.approved = false;
        updates.flagged  = false;
      }
      await updateDoc(doc(db, "critiquePosts", localPost.id), updates);
      setLocalPost((prev) => ({ ...prev, ...updates }));
      setIsEditing(false);
    } catch (err) {
      console.error("Edit failed:", err);
      alert("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "critiquePosts", localPost.id));
      // Notify parent (ProfilePage My Clips / AdminPanel list) to remove the card
      if (onDeleted) onDeleted(localPost.id);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete clip. Please try again.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60)    return "just now";
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className={`cpost-card quiz-carousel ${isDark ? "dark" : "light"}`}>

      {/* ── Meta row ── */}
      <div className="cpost-meta">
        <span className={`cpost-category ${localPost.category}`}>
          {CATEGORY_LABELS[localPost.category] ?? localPost.category}
        </span>
        <span className="cpost-time">{formatDate(localPost.createdAt)}</span>

        {/* Edit / Delete controls — visible to owner and admin */}
        {canEdit && !isEditing && (
          <div className="cpost-mod-actions">
            <button
              className="cpost-mod-btn cpost-mod-btn--edit"
              onClick={() => { setIsEditing(true); setShowDeleteConfirm(false); }}
              title="Edit this clip"
            >
              ✏️ Edit
            </button>
            <button
              className="cpost-mod-btn cpost-mod-btn--delete"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete this clip"
            >
              🗑 Delete
            </button>
          </div>
        )}
      </div>

      {/* ── Inline edit form ── */}
      {isEditing ? (
        <EditForm
          post={localPost}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
          saving={saving}
        />
      ) : (
        <>
          {/* ── Delete confirmation ── */}
          {showDeleteConfirm && (
            <div className="cpost-delete-confirm">
              <p>Are you sure you want to permanently delete this clip?</p>
              <div className="cpost-delete-actions">
                <button
                  className="cpost-delete-confirm-btn"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Yes, Delete"}
                </button>
                <button
                  className="cpost-delete-cancel-btn"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Title ── */}
          <h2 className="cpost-title">{localPost.title}</h2>

          {/* ── Creator ── */}
          <p className="cpost-creator">
            Posted by <span className="cpost-creator-name">{creatorName || localPost.creatorName || "Anonymous"}</span>
          </p>

          {/* ── Embedded video ── */}
          <EmbeddedPlayer videoId={localPost.videoId} />

          {localPost.videoTitle && (
            <p className="cpost-video-label">{localPost.videoTitle}</p>
          )}

          {/* ── Pending re-review notice (shown after video URL was changed) ── */}
          {!localPost.approved && !localPost.flagged && localPost.videoId !== post.videoId && (
            <p className="cpost-pending-notice">⏳ Clip updated — pending re-review by an admin.</p>
          )}

          {/* ── Reactions row ── */}
          <div className="cpost-reactions">
            <button
              className={`cpost-react-btn like ${hasLiked ? "active" : ""}`}
              onClick={() => handleReaction("like")}
              disabled={!uid || acting}
              title={uid ? "Like this clip" : "Log in to react"}
            >
              <span className="cpost-react-icon">+</span>
              <span className="cpost-react-count">{likes.length}</span>
            </button>

            <div className="cpost-react-divider" />

            <button
              className={`cpost-react-btn dislike ${hasDisliked ? "active" : ""}`}
              onClick={() => handleReaction("dislike")}
              disabled={!uid || acting}
              title={uid ? "Dislike this clip" : "Log in to react"}
            >
              <span className="cpost-react-icon">-</span>
              <span className="cpost-react-count">{dislikes.length}</span>
            </button>

            <button
              className="cpost-comment-toggle"
              onClick={() => setShowComments((v) => !v)}
            >
              {showComments ? "Hide Comments" : "Comments"}
            </button>
          </div>

          {showComments && (
            <div className="cpost-comments">
              <CommentSection quizId={`critique-${localPost.id}`} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
