// CritiquePost.jsx
// Drop into: gitgud-client/src/CritiquePost.jsx
//
// Gherkin:
//   Given an approved critique post is rendered
//   When the user views the card
//   Then they see the embedded YouTube video, creator name, category badge, title, and like/dislike counts
//
//   Given the user clicks Like
//   When they are logged in
//   Then the like count increments and the button shows as active
//   And if they had previously disliked, the dislike is removed
//
//   Given the user clicks Dislike
//   When they are logged in
//   Then the dislike count increments and the button shows as active
//   And if they had previously liked, the like is removed
//
//   Given the user is not logged in
//   When they view the post
//   Then the like and dislike buttons are disabled with a tooltip

import { useState, useRef, useEffect } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import CommentSection from "./components/CommentSection";
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

export default function CritiquePost({ post, user }) {
  const { theme } = useTheme();
  const isDark    = theme === "dark";

  const [likes,    setLikes]    = useState(post.likes    ?? []);
  const [dislikes, setDislikes] = useState(post.dislikes ?? []);
  const [acting,   setActing]   = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [creatorName, setCreatorName]   = useState(post.creatorName ?? "");

  const uid = user?.uid;
  const hasLiked    = uid ? likes.includes(uid)    : false;
  const hasDisliked = uid ? dislikes.includes(uid) : false;

  // Fetch fresh creator name
  useEffect(() => {
    if (post.creatorId && !post.creatorName) {
      getDoc(doc(db, "users", post.creatorId))
        .then((s) => { if (s.exists()) setCreatorName(s.data().username ?? ""); })
        .catch(() => {});
    }
  }, [post.creatorId, post.creatorName]);

  const handleReaction = async (type) => {
    if (!uid || acting) return;
    setActing(true);
    try {
      const ref = doc(db, "critiquePosts", post.id);
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

      {/* Category badge + meta */}
      <div className="cpost-meta">
        <span className={`cpost-category ${post.category}`}>
          {CATEGORY_LABELS[post.category] ?? post.category}
        </span>
        <span className="cpost-time">{formatDate(post.createdAt)}</span>
      </div>

      {/* Title */}
      <h2 className="cpost-title">{post.title}</h2>

      {/* Creator */}
      <p className="cpost-creator">
        Posted by <span className="cpost-creator-name">{creatorName || post.creatorName || "Anonymous"}</span>
      </p>

      {/* Embedded video */}
      <EmbeddedPlayer videoId={post.videoId} />

      {/* Video title from oEmbed (shown under player) */}
      {post.videoTitle && (
        <p className="cpost-video-label">{post.videoTitle}</p>
      )}

      {/* Like / Dislike row */}
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
          {showComments ? "Hide Comments" : `Comments`}
        </button>
      </div>

      {/* Comment section (reuses existing CommentSection component) */}
      {showComments && (
        <div className="cpost-comments">
          <CommentSection quizId={`critique-${post.id}`} />
        </div>
      )}
    </div>
  );
}
