// CommentSection.jsx
// Place this file at: gitgud-client/src/components/CommentSection.jsx

import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import "./CommentSection.css";

function CommentSection({ quizId }) {
  const [comments, setComments]     = useState([]);
  const [text, setText]             = useState("");
  // FIX 1: Use a ref + state both so we always have the freshest user
  const [user, setUser]             = useState(() => auth.currentUser);
  const userRef                     = useRef(auth.currentUser);
  const [loading, setLoading]       = useState(true);
  const [posting, setPosting]       = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [editText, setEditText]     = useState("");
  // Reply state
  const [replyingTo, setReplyingTo] = useState(null); // { id, userName }
  const [replyText, setReplyText]   = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState({}); // { commentId: bool }
  const bottomRef = useRef(null);

  // FIX 1: Always keep userRef in sync and re-render on auth changes
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      userRef.current = u;
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Real-time comments listener — top-level only (parentId == null)
  useEffect(() => {
    if (quizId === undefined || quizId === null) return;
    setLoading(true);
    setComments([]);

    const q = query(
      collection(db, "quizComments", String(quizId), "comments"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [quizId]);

  const commentRef = (commentId) =>
    doc(db, "quizComments", String(quizId), "comments", commentId);

  // ── Post new top-level comment ────────────────────────────────────────
  const handlePost = async () => {
    const currentUser = userRef.current;
    if (!text.trim() || !currentUser || posting) return;
    setPosting(true);
    try {
      await addDoc(
        collection(db, "quizComments", String(quizId), "comments"),
        {
          text:      text.trim(),
          userId:    currentUser.uid,
          // FIX 1: Always read the freshest photoURL from auth.currentUser
          userName:  currentUser.displayName || currentUser.email?.split("@")[0] || "Player",
          userPhoto: auth.currentUser?.photoURL || null,
          createdAt: serverTimestamp(),
          likes:     [],
          dislikes:  [],
          parentId:  null,   // top-level
          replyCount: 0,
        }
      );
      setText("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    } catch (err) {
      console.error("Comment post failed:", err);
    } finally {
      setPosting(false);
    }
  };

  // ── Post reply ────────────────────────────────────────────────────────
  const handlePostReply = async (parentId) => {
    const currentUser = userRef.current;
    if (!replyText.trim() || !currentUser || postingReply) return;
    setPostingReply(true);
    try {
      await addDoc(
        collection(db, "quizComments", String(quizId), "comments"),
        {
          text:      replyText.trim(),
          userId:    currentUser.uid,
          userName:  currentUser.displayName || currentUser.email?.split("@")[0] || "Player",
          userPhoto: auth.currentUser?.photoURL || null,
          createdAt: serverTimestamp(),
          likes:     [],
          dislikes:  [],
          parentId:  parentId,
        }
      );
      // Increment parent replyCount
      await updateDoc(commentRef(parentId), {
        replyCount: (comments.find(c => c.id === parentId)?.replyCount || 0) + 1,
      });
      setReplyText("");
      setReplyingTo(null);
      // Auto-expand replies for this thread
      setExpandedReplies(prev => ({ ...prev, [parentId]: true }));
    } catch (err) {
      console.error("Reply post failed:", err);
    } finally {
      setPostingReply(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDelete = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await deleteDoc(commentRef(commentId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────
  const startEdit = (comment) => {
    setEditingId(comment.id);
    setEditText(comment.text);
  };
  const cancelEdit = () => { setEditingId(null); setEditText(""); };

  const handleSaveEdit = async (commentId) => {
    if (!editText.trim()) return;
    try {
      await updateDoc(commentRef(commentId), { text: editText.trim(), edited: true });
      cancelEdit();
    } catch (err) {
      console.error("Edit failed:", err);
    }
  };

  // ── Like / Dislike ────────────────────────────────────────────────────
  const handleReaction = async (comment, type) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const uid = currentUser.uid;
    const hasLiked    = comment.likes?.includes(uid);
    const hasDisliked = comment.dislikes?.includes(uid);
    const ref = commentRef(comment.id);
    try {
      if (type === "like") {
        await updateDoc(ref, hasLiked
          ? { likes: arrayRemove(uid) }
          : { likes: arrayUnion(uid), dislikes: arrayRemove(uid) }
        );
      } else {
        await updateDoc(ref, hasDisliked
          ? { dislikes: arrayRemove(uid) }
          : { dislikes: arrayUnion(uid), likes: arrayRemove(uid) }
        );
      }
    } catch (err) {
      console.error("Reaction failed:", err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost(); }
  };
  const handleEditKeyDown = (e, commentId) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEdit(commentId); }
    if (e.key === "Escape") cancelEdit();
  };
  const handleReplyKeyDown = (e, parentId) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePostReply(parentId); }
    if (e.key === "Escape") { setReplyingTo(null); setReplyText(""); }
  };

  // FIX 1: Avatar always reads from fresh photoURL passed in, not stale closure
  const Avatar = ({ photo, name, size = 40 }) => (
    <div className="cs-avatar" style={{ width: size, height: size }}>
      {photo ? (
        <img
          src={photo}
          alt={name}
          style={{ width: size, height: size }}
          // FIX 1: On error (e.g., stale URL), fall back to initials
          onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
        />
      ) : null}
      <div
        className="cs-avatar-fallback"
        style={{
          width: size, height: size, fontSize: size * 0.42,
          display: photo ? "none" : "flex",
        }}
      >
        {name?.[0]?.toUpperCase() ?? "?"}
      </div>
    </div>
  );

  const formatTime = (ts) => {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60)    return "just now";
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  // Separate top-level and replies
  const topLevel = comments.filter(c => !c.parentId);
  const getReplies = (parentId) => comments.filter(c => c.parentId === parentId);

  // FIX 3: isOwner uses the live userRef so it works for ALL logged-in users
  const isOwner = (comment) => userRef.current?.uid === comment.userId;

  const renderComment = (c, isReply = false) => {
    const liked      = c.likes?.includes(userRef.current?.uid);
    const disliked   = c.dislikes?.includes(userRef.current?.uid);
    const likeCount  = c.likes?.length ?? 0;
    const dislikeCount = c.dislikes?.length ?? 0;
    const isEditing  = editingId === c.id;
    const replies    = getReplies(c.id);
    const showReplies = expandedReplies[c.id];

    return (
      <div
        key={c.id}
        className={`cs-comment ${isReply ? "cs-reply" : ""}`}
      >
        {/* FIX 1: Pass the stored userPhoto (captured at post time) */}
        <Avatar photo={c.userPhoto} name={c.userName} size={isReply ? 30 : 40} />

        <div className="cs-comment-body">
          {/* FIX 5: Username now uses cs-username class with accent colour + bold */}
          <div className="cs-comment-meta">
            <span className="cs-username">{c.userName}</span>
            <span className="cs-timestamp">{formatTime(c.createdAt)}</span>
            {c.edited && <span className="cs-edited">(edited)</span>}
          </div>

          {isEditing ? (
            <div className="cs-edit-wrap">
              <input
                className="cs-edit-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => handleEditKeyDown(e, c.id)}
                maxLength={500}
                autoFocus
              />
              <div className="cs-edit-actions">
                <button className="cs-edit-save"   onClick={() => handleSaveEdit(c.id)}>Save</button>
                <button className="cs-edit-cancel" onClick={cancelEdit}>Cancel</button>
              </div>
            </div>
          ) : (
            <p className="cs-comment-text">{c.text}</p>
          )}

          <div className="cs-comment-footer">
            <button
              className={`cs-react-btn ${liked ? "active-like" : ""}`}
              onClick={() => handleReaction(c, "like")}
              disabled={!userRef.current}
              title={userRef.current ? "Like" : "Log in to react"}
            >
              👍 <span className="cs-react-count">{likeCount > 0 ? likeCount : ""}</span>
            </button>

            <button
              className={`cs-react-btn ${disliked ? "active-dislike" : ""}`}
              onClick={() => handleReaction(c, "dislike")}
              disabled={!userRef.current}
              title={userRef.current ? "Dislike" : "Log in to react"}
            >
              👎 <span className="cs-react-count">{dislikeCount > 0 ? dislikeCount : ""}</span>
            </button>

            {/* FIX 4: Reply button for all logged-in users, on top-level only */}
            {!isReply && userRef.current && (
              <button
                className="cs-reply-btn"
                onClick={() => {
                  if (replyingTo?.id === c.id) {
                    setReplyingTo(null);
                    setReplyText("");
                  } else {
                    setReplyingTo({ id: c.id, userName: c.userName });
                    setReplyText("");
                  }
                }}
              >
                💬 Reply
              </button>
            )}

            {/* FIX 3: Show Edit/Delete for the comment's OWN author */}
            {isOwner(c) && !isEditing && (
              <>
                <button className="cs-owner-btn" onClick={() => startEdit(c)}>Edit</button>
                <button className="cs-owner-btn cs-delete-btn" onClick={() => handleDelete(c.id)}>Delete</button>
              </>
            )}
          </div>

          {/* FIX 4: Reply input box */}
          {!isReply && replyingTo?.id === c.id && (
            <div className="cs-reply-input-wrap">
              <Avatar
                photo={auth.currentUser?.photoURL}
                name={userRef.current?.displayName || userRef.current?.email}
                size={28}
              />
              <div className="cs-input-wrap cs-reply-input-inner">
                <input
                  className="cs-input"
                  type="text"
                  placeholder={`Replying to ${replyingTo.userName}…`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => handleReplyKeyDown(e, c.id)}
                  maxLength={500}
                  disabled={postingReply}
                  autoFocus
                />
                <button
                  className="cs-post-btn"
                  onClick={() => handlePostReply(c.id)}
                  disabled={!replyText.trim() || postingReply}
                >
                  {postingReply ? "…" : "Reply"}
                </button>
              </div>
            </div>
          )}

          {/* FIX 4: Show/hide replies toggle */}
          {!isReply && replies.length > 0 && (
            <button
              className="cs-toggle-replies"
              onClick={() => setExpandedReplies(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
            >
              {showReplies
                ? `▲ Hide ${replies.length} repl${replies.length !== 1 ? "ies" : "y"}`
                : `▼ Show ${replies.length} repl${replies.length !== 1 ? "ies" : "y"}`}
            </button>
          )}

          {/* FIX 4: Nested replies */}
          {!isReply && showReplies && replies.length > 0 && (
            <div className="cs-replies-list">
              {replies.map(r => renderComment(r, true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="cs-root">
      <div className="cs-header">
        <span className="cs-title">💬 Discussion</span>
        <span className="cs-count">
          {loading ? "—" : `${topLevel.length} comment${topLevel.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="cs-list">
        {loading && (
          <div className="cs-state">
            <span className="cs-spinner" />
            <span>Loading comments…</span>
          </div>
        )}

        {!loading && topLevel.length === 0 && (
          <div className="cs-state cs-empty">
            <span className="cs-empty-icon">🎮</span>
            <span>No comments yet — start the discussion!</span>
          </div>
        )}

        {!loading && topLevel.map((c, i) => (
          <div key={c.id} style={{ animationDelay: `${i * 40}ms` }} className="cs-comment-animated">
            {renderComment(c, false)}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {userRef.current ? (
        <div className="cs-input-area">
          {/* FIX 1: Always read photoURL fresh from auth.currentUser */}
          <Avatar
            photo={auth.currentUser?.photoURL}
            name={userRef.current?.displayName || userRef.current?.email}
            size={36}
          />
          <div className="cs-input-wrap">
            {/* FIX 2: Input text color explicitly set via CSS class */}
            <input
              className="cs-input"
              type="text"
              placeholder="Add a comment…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={500}
              disabled={posting}
            />
            <button
              className="cs-post-btn"
              onClick={handlePost}
              disabled={!text.trim() || posting}
              aria-label="Post comment"
            >
              {posting ? "…" : "Post"}
            </button>
          </div>
        </div>
      ) : (
        <div className="cs-login-prompt">
          <span>🔒</span>
          <span>
            <a href="/auth" className="cs-login-link">Log in</a> to join the discussion
          </span>
        </div>
      )}
    </div>
  );
}

export default CommentSection;
