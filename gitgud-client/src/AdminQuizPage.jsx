// AdminQuizPage.jsx
// Drop into: gitgud-client/src/AdminQuizPage.jsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  collection, getDocs, query, where, doc, getDoc, deleteDoc, updateDoc,
  addDoc, onSnapshot, orderBy, serverTimestamp, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import {
  QUESTION_TYPES,
  isValueAnswerCorrect,
  isRankingCorrect,
  calculateScore,
} from "./adminQuizUtils";
import { awardPoints } from "./usePoints";
import "./AdminQuizPage.css";
import { updateQuizStats } from "./statsService";
import { FRAMES } from "./frames";
import { useSkillTree, useSkillExp } from "./skilltree/useSkillTree";
import { applyFiftyFifty, applyReveal1Wrong, canTryAgain } from "./skilltree/skillTreeEngine";
import { PERK_KEY } from "./skilltree/skillTreeData";
import SkillPerksDropdown from "./components/SkillPerksDropdown";

// ── Game metadata ─────────────────────────────────────────────────────────────
const GAME_META = {
  valorant: {
    name: "Valorant",
    image: "https://res.cloudinary.com/dyis0klmz/image/upload/v1777185621/ValorantSplash_siafhc.jpg",
    accent: "#ff4655",
    description: "Test your Valorant game sense",
  },
  cs2: {
    name: "Counter-Strike 2",
    image: "https://res.cloudinary.com/dyis0klmz/image/upload/v1777185626/CS2Spalsh_sg4smz.jpg",
    accent: "#eeb02a",
    description: "Master your CS2 knowledge",
  },
  other: {
    name: "Other Games",
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop",
    accent: "#a855f7",
    description: "Test your knowledge across titles",
  },
};

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

// ── YouTube Video Question Player ─────────────────────────────────────────────
// Mirrors QuizCarousel's YoutubePlayer approach exactly:
// - wrapperRef: stable outer div, never replaced
// - creates a fresh inner div for YT to replace with an iframe each mount
// - answers hidden until video pauses at pauseAt seconds
// - video resumes automatically after submit
function VideoMcPlayer({ question, answer, onAnswer, submitted, onVideoEnded, hiddenChoices = [], revealedWrong = null, revealedCorrect = null }) {
  const wrapperRef   = useRef(null);  // stable outer div ref
  const playerRef    = useRef(null);
  const pollRef      = useRef(null);
  const hasPausedRef = useRef(false);
  const [videoPaused, setVideoPaused] = useState(false);

  const videoId = question.videoId;
  const pauseAt = Number(question.pauseAt) || 10;
  const LABELS  = ["A", "B", "C", "D", "E", "F"];
  const isCorrect = submitted && answer === question.correctIndex;

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
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
          setVideoPaused(true);
          stopPoll();
        }
      } catch (_) {}
    }, 250);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseAt]);

  // Build fresh YT player on mount
  useEffect(() => {
    let destroyed = false;

    loadYouTubeApi().then(() => {
      if (destroyed || !wrapperRef.current) return;

      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (_) {}
        playerRef.current = null;
      }

      hasPausedRef.current = false;
      stopPoll();

      // Create a fresh target div — YT replaces it with an iframe.
      // Using a stale div causes the black screen.
      wrapperRef.current.innerHTML = '';
      const mountDiv = document.createElement('div');
      wrapperRef.current.appendChild(mountDiv);

      playerRef.current = new window.YT.Player(mountDiv, {
         videoId,
          playerVars: { autoplay: 0, rel: 0, modestbranding: 1, start: 0 },
          events: {
            onStateChange: (e) => {
              if (e.data === 1 && !hasPausedRef.current) startPoll();
              if (e.data === 0) {
                stopPoll();
                // Notify parent so it can show complete screen after clip finishes
                if (onVideoEnded) onVideoEnded();
              }
            },
          },
       });
    });

    return () => {
      destroyed = true;
      stopPoll();
      try { playerRef.current?.destroy(); } catch (_) {}
      playerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Resume video when answer is submitted
  useEffect(() => {
    if (submitted && playerRef.current && hasPausedRef.current) {
      try { playerRef.current.playVideo(); } catch (_) {}
    }
  }, [submitted]);

  // Stop poller if submitted externally
  useEffect(() => {
    if (submitted) stopPoll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  return (
    <div className="aqp-video-mc-player">
      {/* Hint bar — sits above the video box */}
      <div className="aqp-video-label">
        {!videoPaused && !submitted && (
          <span className="aqp-video-hint">▶ Press play — video pauses at {pauseAt}s</span>
        )}
        {videoPaused && !submitted && (
          <span className="aqp-video-hint paused">⏸ Paused — pick your answer below</span>
        )}
        {submitted && (
          <span className="aqp-video-hint resumed">▶ Resuming to show the outcome…</span>
        )}
      </div>

      {/* Video embed — always 16:9. wrapperRef fills the container; YT replaces its
           inner child with an iframe. CSS handles all sizing via aspect-ratio. */}
      <div className="aqp-video-wrap">
        <div ref={wrapperRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      </div>

      {/* Waiting state — before video pauses */}
      {!videoPaused && !submitted && (
        <div className="aqp-video-waiting">
          <span className="aqp-waiting-icon">[ ]</span>
          <p>Watch the clip — your choices appear when the video pauses.</p>
        </div>
      )}

      {/* Answer choices — only shown after pause */}
      {(videoPaused || submitted) && (
        <>
          <div className="aqp-choices">
            {question.choices.map((choice, idx) => {
              if (hiddenChoices.includes(idx)) return null;
              let cls = "aqp-choice-btn";
              if (submitted) {
                cls += " locked";
                if (idx === question.correctIndex) cls += " correct";
                else if (idx === answer)            cls += " wrong";
              } else if (answer === idx) {
                cls += " selected";
              }
              if (!submitted) {
                if (idx === revealedCorrect) cls += " perk-correct";
                if (idx === revealedWrong)   cls += " perk-wrong";
              }
              return (
                <button key={idx} className={cls}
                  onClick={() => !submitted && onAnswer(idx)} disabled={submitted}>
                  <span className="aqp-choice-label">{LABELS[idx]}</span>
                  <span className="aqp-choice-text">{choice}</span>
                  {submitted && idx === question.correctIndex && <span className="aqp-choice-icon">✓</span>}
                  {submitted && idx === answer && idx !== question.correctIndex && <span className="aqp-choice-icon wrong">✗</span>}
                </button>
              );
            })}
          </div>

          {submitted && (
            <div className={`aqp-rank-result ${isCorrect ? "correct" : "wrong"}`}>
              {isCorrect ? (
                <p className="aqp-verdict correct">Correct! +10 points</p>
              ) : (
                <>
                  <p className="aqp-verdict wrong">Incorrect</p>
                  <p className="aqp-chosen">
                    You chose: <strong>{question.choices[answer]}</strong> — correct:{" "}
                    <strong>{question.choices[question.correctIndex]}</strong>
                  </p>
                </>
              )}
              <p className="aqp-reason">
                <span className="aqp-reason-label">Why:</span> {question.reason}
              </p>
              <p className="aqp-resume-note">▶ Watch the clip to see the outcome.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Rank Question Player ──────────────────────────────────────────────────────
function RankPlayer({ question, answer, onAnswer, submitted }) {
  const initial = question.items.map((_, i) => i);
  const order = answer ?? initial;
  const dragRef = useRef(null);

  const handleDragStart = (e, pos) => {
    if (submitted) return;
    dragRef.current = pos;
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDrop = (e, pos) => {
    e.preventDefault();
    if (submitted || dragRef.current === null || dragRef.current === pos) return;
    const updated = [...order];
    const [moved] = updated.splice(dragRef.current, 1);
    updated.splice(pos, 0, moved);
    onAnswer(updated);
    dragRef.current = null;
  };

  const isCorrect = submitted && isRankingCorrect(order, question.correctOrder);
  const correctLabels = question.correctOrder.map((idx) => question.items[idx]);

  return (
    <div className="aqp-rank-player">
      <p className="aqp-rank-instruction">Drag cards into the correct order — top is 1st, bottom is last.</p>
      <div className="aqp-rank-list">
        {order.map((itemIdx, pos) => {
          const item = question.items[itemIdx];
          let cardClass = "aqp-rank-card";
          if (submitted) cardClass += order[pos] === question.correctOrder[pos] ? " correct-pos" : " wrong-pos";
          return (
            <div key={`rank-${pos}`} className={cardClass}
              draggable={!submitted}
              onDragStart={(e) => handleDragStart(e, pos)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, pos)}>
              <span className="aqp-rank-pos">{pos + 1}</span>
              {question.useImages && item?.imageUrl && <img src={item.imageUrl} alt={item.label} className="aqp-rank-img" />}
              <span className="aqp-rank-text">{item?.label || `Item ${itemIdx + 1}`}</span>
              {!submitted && <span className="aqp-drag-handle">drag</span>}
            </div>
          );
        })}
      </div>
      {submitted && (
        <div className={`aqp-rank-result ${isCorrect ? "correct" : "wrong"}`}>
          {isCorrect ? (
            <p className="aqp-verdict correct">Correct ranking! +10 points</p>
          ) : (
            <>
              <p className="aqp-verdict wrong">Incorrect ranking</p>
              <div className="aqp-correct-order">
                <p className="aqp-co-label">Correct order:</p>
                {correctLabels.map((item, i) => (
                  <div key={i} className="aqp-co-row">
                    <span className="aqp-co-num">{i + 1}</span>
                    {question.useImages && item?.imageUrl && <img src={item.imageUrl} alt={item.label} className="aqp-co-img" />}
                    <span>{item?.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="aqp-reason"><span className="aqp-reason-label">Why:</span> {question.reason}</p>
        </div>
      )}
    </div>
  );
}

// ── Enter Value Player ────────────────────────────────────────────────────────
function EnterValuePlayer({ question, answer, onAnswer, submitted }) {
  const isCorrect = submitted && isValueAnswerCorrect(answer ?? "", question.correctAnswer);
  return (
    <div className="aqp-value-player">
      {question.imageUrl && (
        <img src={question.imageUrl} alt="Question context" className="aqp-context-image" />
      )}
      <input
        className={`aqp-value-input ${submitted ? (isCorrect ? "correct" : "wrong") : ""}`}
        placeholder="Type your answer here..."
        value={answer ?? ""}
        onChange={(e) => !submitted && onAnswer(e.target.value)}
        disabled={submitted}
      />
      <p className="aqp-value-hint">Numbers are matched flexibly — dollar signs, commas, and units are optional.</p>
      {submitted && (
        <div className={`aqp-rank-result ${isCorrect ? "correct" : "wrong"}`}>
          {isCorrect ? (
            <p className="aqp-verdict correct">Correct! +10 points</p>
          ) : (
            <>
              <p className="aqp-verdict wrong">Incorrect</p>
              <p className="aqp-chosen">You answered: <strong>{answer || "(no answer)"}</strong> — correct: <strong>{question.correctAnswer}</strong></p>
            </>
          )}
          <p className="aqp-reason"><span className="aqp-reason-label">Why:</span> {question.reason}</p>
        </div>
      )}
    </div>
  );
}

// ── Multi Choice Player ───────────────────────────────────────────────────────
function MultiChoicePlayer({ question, answer, onAnswer, submitted, hiddenChoices = [], revealedWrong = null, revealedCorrect = null }) {
  const LABELS = ["A", "B", "C", "D", "E", "F"];
  const isCorrect = submitted && answer === question.correctIndex;
  return (
    <div className="aqp-mc-player">
      {question.imageUrl && (
        <img src={question.imageUrl} alt="Question context" className="aqp-context-image" />
      )}
      <div className="aqp-choices">
        {question.choices.map((choice, idx) => {
          if (hiddenChoices.includes(idx)) return null;
          let cls = "aqp-choice-btn";
          if (submitted) {
            cls += " locked";
            if (idx === question.correctIndex) cls += " correct";
            else if (idx === answer) cls += " wrong";
          } else if (answer === idx) {
            cls += " selected";
          }
          if (!submitted) {
            if (idx === revealedCorrect) cls += " perk-correct";
            if (idx === revealedWrong)   cls += " perk-wrong";
          }
          return (
            <button key={idx} className={cls} onClick={() => !submitted && onAnswer(idx)} disabled={submitted}>
              <span className="aqp-choice-label">{LABELS[idx]}</span>
              <span className="aqp-choice-text">{choice}</span>
              {submitted && idx === question.correctIndex && <span className="aqp-choice-icon">✓</span>}
              {submitted && idx === answer && idx !== question.correctIndex && <span className="aqp-choice-icon wrong">✗</span>}
            </button>
          );
        })}
      </div>
      {submitted && (
        <div className={`aqp-rank-result ${isCorrect ? "correct" : "wrong"}`}>
          {isCorrect ? (
            <p className="aqp-verdict correct">Correct! +10 points</p>
          ) : (
            <>
              <p className="aqp-verdict wrong">Incorrect</p>
              <p className="aqp-chosen">You chose: <strong>{question.choices[answer]}</strong> — correct: <strong>{question.choices[question.correctIndex]}</strong></p>
            </>
          )}
          <p className="aqp-reason"><span className="aqp-reason-label">Why:</span> {question.reason}</p>
        </div>
      )}
    </div>
  );
}

// ── Per-Question Comment Section ──────────────────────────────────────────────
// Thread ID: adminQuizComments/{quizId}_q{qIndex}/comments
function QuizQuestionComments({ quizId, questionIndex }) {
  const threadId = `${quizId}_q${questionIndex}`;
  const [comments,        setComments]        = useState([]);
  const [text,            setText]            = useState("");
  const [user,            setUser]            = useState(() => auth.currentUser);
  const userRef                               = useRef(auth.currentUser);
  const [loading,         setLoading]         = useState(true);
  const [posting,         setPosting]         = useState(false);
  const [editingId,       setEditingId]       = useState(null);
  const [editText,        setEditText]        = useState("");
  const [replyingTo,      setReplyingTo]      = useState(null);
  const [replyText,       setReplyText]       = useState("");
  const [postingReply,    setPostingReply]    = useState(false);
  const [expandedReplies, setExpandedReplies] = useState({});
  const [userProfiles,    setUserProfiles]    = useState({});
  const fetchingProfiles = useRef(new Set());
  const bottomRef = useRef(null);
  const MODERATION_URL = import.meta.env.VITE_MODERATION_URL || "http://localhost:5001";

  const moderateText = async (txt) => {
    try {
      const res = await fetch(`${MODERATION_URL}/moderate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: txt }),
      });
      const data = await res.json();
      return data.allowed !== false;
    } catch { return true; }
  };

  const fetchUserProfile = async (userId) => {
    if (!userId || userProfiles[userId] || fetchingProfiles.current.has(userId)) return;
    fetchingProfiles.current.add(userId);
    try {
      const snap = await getDoc(doc(db, "users", userId));
      if (snap.exists()) {
        const d = snap.data();
        const frameData = FRAMES.find(f => f.id === d.equippedFrame) || null;
        setUserProfiles(prev => ({
          ...prev,
          [userId]: { userName: d.username || "", userPhoto: d.photoURL || "", frameImage: frameData?.image || null },
        }));
      }
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => { userRef.current = u; setUser(u); });
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoading(true); setComments([]);
    const q = query(
      collection(db, "adminQuizComments", threadId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setComments(docs); setLoading(false);
      [...new Set(docs.map(d => d.userId).filter(Boolean))].forEach(fetchUserProfile);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const cRef = (cId) => doc(db, "adminQuizComments", threadId, "comments", cId);

  const handlePost = async () => {
    const cu = userRef.current;
    if (!text.trim() || !cu || posting) return;
    if (!await moderateText(text.trim())) return;
    setPosting(true);
    try {
      await addDoc(collection(db, "adminQuizComments", threadId, "comments"), {
        text: text.trim(), userId: cu.uid,
        userName: cu.displayName || cu.email?.split("@")[0] || "Player",
        userPhoto: auth.currentUser?.photoURL || null,
        createdAt: serverTimestamp(), likes: [], dislikes: [], parentId: null, replyCount: 0,
      });
      setText("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    } catch (err) { console.error(err); } finally { setPosting(false); }
  };

  const handlePostReply = async (parentId) => {
    const cu = userRef.current;
    if (!replyText.trim() || !cu || postingReply) return;
    if (!await moderateText(replyText.trim())) return;
    setPostingReply(true);
    try {
      await addDoc(collection(db, "adminQuizComments", threadId, "comments"), {
        text: replyText.trim(), userId: cu.uid,
        userName: cu.displayName || cu.email?.split("@")[0] || "Player",
        userPhoto: auth.currentUser?.photoURL || null,
        createdAt: serverTimestamp(), likes: [], dislikes: [], parentId,
      });
      const parent = comments.find(c => c.id === parentId);
      await updateDoc(cRef(parentId), { replyCount: (parent?.replyCount || 0) + 1 });
      setReplyText(""); setReplyingTo(null);
      setExpandedReplies(prev => ({ ...prev, [parentId]: true }));
    } catch (err) { console.error(err); } finally { setPostingReply(false); }
  };

  const handleDelete = async (cId) => {
    if (!window.confirm("Delete this comment?")) return;
    try { await deleteDoc(cRef(cId)); } catch (err) { console.error(err); }
  };

  const startEdit = (c) => { setEditingId(c.id); setEditText(c.text); };
  const cancelEdit = () => { setEditingId(null); setEditText(""); };
  const handleSaveEdit = async (cId) => {
    if (!editText.trim()) return;
    try { await updateDoc(cRef(cId), { text: editText.trim(), edited: true }); cancelEdit(); }
    catch (err) { console.error(err); }
  };

  const handleReaction = async (c, type) => {
    const cu = userRef.current; if (!cu) return;
    const uid = cu.uid;
    const hasLiked = c.likes?.includes(uid), hasDisliked = c.dislikes?.includes(uid);
    const ref = cRef(c.id);
    try {
      if (type === "like") {
        await updateDoc(ref, hasLiked ? { likes: arrayRemove(uid) } : { likes: arrayUnion(uid), dislikes: arrayRemove(uid) });
      } else {
        await updateDoc(ref, hasDisliked ? { dislikes: arrayRemove(uid) } : { dislikes: arrayUnion(uid), likes: arrayRemove(uid) });
      }
    } catch (err) { console.error(err); }
  };

  const formatTime = (ts) => {
    if (!ts?.toDate) return "";
    const d = ts.toDate(), now = new Date(), diff = Math.floor((now - d) / 1000);
    if (diff < 60)    return "just now";
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  // Avatar with optional profile frame
  const Avatar = ({ userId, photo, name, size = 40 }) => {
    const profile = userProfiles[userId];
    const frameImg = profile?.frameImage || null;
    return (
      <div className="aqc-avatar-wrap" style={{ width: size, height: size }}>
        <div className="aqc-avatar-inner" style={{ width: size, height: size }}>
          {photo ? (
            <img src={photo} alt={name} className="aqc-avatar-photo" style={{ width: size, height: size }}
              onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
          ) : null}
          <div className="aqc-avatar-fallback"
            style={{ width: size, height: size, fontSize: size * 0.42, display: photo ? "none" : "flex" }}>
            {name?.[0]?.toUpperCase() ?? "?"}
          </div>
        </div>
        {frameImg && (
          <img src={frameImg} alt="frame" className="aqc-avatar-frame"
            style={{ width: size * 1.4, height: size * 1.4 }} />
        )}
      </div>
    );
  };

  const topLevel = comments.filter(c => !c.parentId);
  const getReplies = (pId) => comments.filter(c => c.parentId === pId);
  const isOwner = (c) => userRef.current?.uid === c.userId;

  const renderComment = (c, isReply = false) => {
    const profile = userProfiles[c.userId];
    const displayName  = profile?.userName  || c.userName;
    const displayPhoto = profile?.userPhoto || c.userPhoto;
    const liked    = c.likes?.includes(userRef.current?.uid);
    const disliked = c.dislikes?.includes(userRef.current?.uid);
    const likeCount    = c.likes?.length ?? 0;
    const dislikeCount = c.dislikes?.length ?? 0;
    const isEditing = editingId === c.id;
    const replies   = getReplies(c.id);
    const showReplies = expandedReplies[c.id];

    return (
      <div key={c.id} className={`aqc-comment ${isReply ? "aqc-reply" : ""}`}>
        <Link to={`/profile/${c.userId}`} style={{ textDecoration: "none" }}>
          <Avatar userId={c.userId} photo={displayPhoto} name={displayName} size={isReply ? 28 : 36} />
        </Link>
        <div className="aqc-comment-body">
          <div className="aqc-comment-meta">
            <span className="aqc-username">{displayName}</span>
            <span className="aqc-timestamp">{formatTime(c.createdAt)}</span>
            {c.edited && <span className="aqc-edited">(edited)</span>}
          </div>
          {isEditing ? (
            <div className="aqc-edit-wrap">
              <input className="aqc-edit-input" value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEdit(c.id); }
                  if (e.key === "Escape") cancelEdit();
                }} maxLength={500} autoFocus />
              <div className="aqc-edit-actions">
                <button className="aqc-edit-save" onClick={() => handleSaveEdit(c.id)}>Save</button>
                <button className="aqc-edit-cancel" onClick={cancelEdit}>Cancel</button>
              </div>
            </div>
          ) : (
            <p className="aqc-comment-text">{c.text}</p>
          )}
          <div className="aqc-comment-footer">
            <button className={`aqc-react-btn ${liked ? "active-like" : ""}`}
              onClick={() => handleReaction(c, "like")} disabled={!userRef.current}>
              👍 <span className="aqc-react-count">{likeCount > 0 ? likeCount : ""}</span>
            </button>
            <button className={`aqc-react-btn ${disliked ? "active-dislike" : ""}`}
              onClick={() => handleReaction(c, "dislike")} disabled={!userRef.current}>
              👎 <span className="aqc-react-count">{dislikeCount > 0 ? dislikeCount : ""}</span>
            </button>
            {!isReply && userRef.current && (
              <button className="aqc-reply-btn" onClick={() => {
                if (replyingTo?.id === c.id) { setReplyingTo(null); setReplyText(""); }
                else { setReplyingTo({ id: c.id, userName: displayName }); setReplyText(""); }
              }}>💬 Reply</button>
            )}
            {isOwner(c) && !isEditing && (
              <>
                <button className="aqc-owner-btn" onClick={() => startEdit(c)}>Edit</button>
                <button className="aqc-owner-btn aqc-delete-btn" onClick={() => handleDelete(c.id)}>Delete</button>
              </>
            )}
          </div>
          {!isReply && replyingTo?.id === c.id && (
            <div className="aqc-reply-input-wrap">
              <Avatar userId={userRef.current?.uid} photo={auth.currentUser?.photoURL}
                name={userRef.current?.displayName} size={24} />
              <div className="aqc-input-wrap">
                <input className="aqc-comment-input" type="text"
                  placeholder={`Replying to ${replyingTo.userName}…`}
                  value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePostReply(c.id); }
                    if (e.key === "Escape") { setReplyingTo(null); setReplyText(""); }
                  }} maxLength={500} disabled={postingReply} autoFocus />
                <button className="aqc-post-btn" onClick={() => handlePostReply(c.id)}
                  disabled={!replyText.trim() || postingReply}>
                  {postingReply ? "…" : "Reply"}
                </button>
              </div>
            </div>
          )}
          {!isReply && replies.length > 0 && (
            <button className="aqc-toggle-replies"
              onClick={() => setExpandedReplies(prev => ({ ...prev, [c.id]: !prev[c.id] }))}>
              {showReplies ? `▲ Hide ${replies.length} repl${replies.length !== 1 ? "ies" : "y"}`
                           : `▼ Show ${replies.length} repl${replies.length !== 1 ? "ies" : "y"}`}
            </button>
          )}
          {!isReply && showReplies && replies.length > 0 && (
            <div className="aqc-replies-list">{replies.map(r => renderComment(r, true))}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="aqc-comments-root">
      <div className="aqc-comments-header">
        <span className="aqc-comments-title">💬 Discussion</span>
        <span className="aqc-comments-count">
          {loading ? "—" : `${topLevel.length} comment${topLevel.length !== 1 ? "s" : ""}`}
        </span>
      </div>
      <div className="aqc-comments-list">
        {loading && (
          <div className="aqc-comments-state"><span className="aqc-spinner" /><span>Loading comments…</span></div>
        )}
        {!loading && topLevel.length === 0 && (
          <div className="aqc-comments-state aqc-comments-empty">
            <span>🎮</span><span>No comments yet — be first to discuss this question!</span>
          </div>
        )}
        {!loading && topLevel.map((c, i) => (
          <div key={c.id} className="aqc-comment-animated" style={{ animationDelay: `${i * 40}ms` }}>
            {renderComment(c, false)}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {user ? (
        <div className="aqc-comment-input-area">
          <Link to={`/profile/${user.uid}`} style={{ textDecoration: "none" }}>
            <Avatar userId={user.uid} photo={auth.currentUser?.photoURL}
              name={user.displayName || user.email} size={32} />
          </Link>
          <div className="aqc-input-wrap">
            <input className="aqc-comment-input" type="text"
              placeholder="Share your thoughts on this question…"
              value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
              maxLength={500} disabled={posting} />
            <button className="aqc-post-btn" onClick={handlePost} disabled={!text.trim() || posting}>
              {posting ? "…" : "Post"}
            </button>
          </div>
        </div>
      ) : (
        <div className="aqc-login-prompt">
          <span>🔒</span>
          <span><a href="/auth" className="aqc-login-link">Log in</a> to join the discussion</span>
        </div>
      )}
    </div>
  );
}

// ── Quiz Player ───────────────────────────────────────────────────────────────
function AdminQuizPlayer({ quiz, user, onBack }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const questions = quiz.questions ?? [];
  const total = questions.length;

  const [current,       setCurrent]       = useState(0);
  const [answers,       setAnswers]       = useState(Array(total).fill(null));
  const [submitted,     setSubmitted]     = useState(Array(total).fill(false));
  const [showComplete,  setShowComplete]  = useState(false);
  const videoEndTimerRef = useRef(null); // fallback timer for VIDEO_MC last-question completion

  const { unlockedPerks, passivePerks, activePerks, sessionActivePerks, toggleSessionPerk, resetSessionPerks } = useSkillTree(user?.uid);
  const { getExp } = useSkillExp(unlockedPerks, sessionActivePerks);
  const [hiddenChoices,      setHiddenChoices]      = useState([]);
  const [revealedWrong,      setRevealedWrong]      = useState(null);
  const [revealedCorrect,    setRevealedCorrect]    = useState(null);
  const [questionRetryUsed,  setQuestionRetryUsed]  = useState(false);
  const [tryAgainUsed,       setTryAgainUsed]       = useState(false);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);

  const resetQuestionPerkState = () => {
    setHiddenChoices([]); setRevealedWrong(null); setRevealedCorrect(null); setQuestionRetryUsed(false);
  };

  const q           = questions[current];
  const isSubmitted = submitted[current];
  const currAnswer  = answers[current];
  const isMC        = q?.type === QUESTION_TYPES.MULTI_CHOICE || q?.type === QUESTION_TYPES.VIDEO_MC;
  const isVideoMC   = q?.type === QUESTION_TYPES.VIDEO_MC;

  const handleAnswer = (val) => setAnswers(prev => prev.map((a, i) => i === current ? val : a));
  const canSubmit = () => {
    if (isSubmitted) return false;
    if (q?.type === QUESTION_TYPES.RANK) return true;
    return currAnswer !== null && currAnswer !== undefined && currAnswer !== "";
  };

  const handleFiftyFifty = () => {
    if (!isMC) return;
    const wrong = q.choices.map((_, i) => i).filter(i => i !== q.correctIndex);
    const result = applyFiftyFifty(wrong, q.correctIndex, unlockedPerks, sessionActivePerks);
    setHiddenChoices(result.hiddenIndices); setRevealedWrong(result.revealedWrong); setRevealedCorrect(result.revealedCorrect);
    toggleSessionPerk(PERK_KEY.FIFTY_FIFTY);
    if (unlockedPerks.includes(PERK_KEY.COIN_TOSS)) toggleSessionPerk(PERK_KEY.COIN_TOSS);
  };
  const handleReveal1Wrong = () => {
    if (!isMC) return;
    const wrong = q.choices.map((_, i) => i).filter(i => i !== q.correctIndex);
    setRevealedWrong(applyReveal1Wrong(wrong)); toggleSessionPerk(PERK_KEY.REVEAL_1_WRONG);
  };
  const handleRetryQuestion = () => {
    if (questionRetryUsed) return;
    setAnswers(prev => prev.map((a, i) => i === current ? null : a));
    setSubmitted(prev => prev.map((s, i) => i === current ? false : s));
    resetQuestionPerkState(); setQuestionRetryUsed(true);
  };
  const handleTryAgain = () => {
    if (tryAgainUsed) return;
    setShowComplete(false); setCurrent(0);
    setAnswers(Array(total).fill(null)); setSubmitted(Array(total).fill(false));
    resetQuestionPerkState(); setConsecutiveCorrect(0); setTryAgainUsed(true); resetSessionPerks();
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    const updatedSubmitted = submitted.map((s, i) => i === current ? true : s);
    setSubmitted(updatedSubmitted);

    const baseType = (q.type === QUESTION_TYPES.VIDEO_MC) ? QUESTION_TYPES.MULTI_CHOICE : q.type;
    const answerObj = { type: baseType };
    if (q.type === QUESTION_TYPES.MULTI_CHOICE || q.type === QUESTION_TYPES.VIDEO_MC) {
      answerObj.playerAnswer = currAnswer; answerObj.correctIndex = q.correctIndex;
    } else if (q.type === QUESTION_TYPES.ENTER_VALUE) {
      answerObj.playerAnswer = currAnswer ?? ""; answerObj.correctAnswer = q.correctAnswer;
    } else if (q.type === QUESTION_TYPES.RANK) {
      answerObj.playerAnswer = currAnswer ?? q.items.map((_, i) => i); answerObj.correctOrder = q.correctOrder;
    }
    const { correct } = calculateScore([answerObj]);
    if (correct && user?.uid) awardPoints(user.uid, getExp(10, consecutiveCorrect)).catch(console.error);
    if (correct) setConsecutiveCorrect(c => c + 1); else setConsecutiveCorrect(0);

    if (updatedSubmitted.every(Boolean) && current === total - 1) {
      const finalAnswers = questions.map((question, i) => {
        const t = question.type === QUESTION_TYPES.VIDEO_MC ? QUESTION_TYPES.MULTI_CHOICE : question.type;
        const a = { type: t };
        if (question.type === QUESTION_TYPES.MULTI_CHOICE || question.type === QUESTION_TYPES.VIDEO_MC) {
          a.playerAnswer = answers[i]; a.correctIndex = question.correctIndex;
        } else if (question.type === QUESTION_TYPES.ENTER_VALUE) {
          a.playerAnswer = answers[i] ?? ""; a.correctAnswer = question.correctAnswer;
        } else if (question.type === QUESTION_TYPES.RANK) {
          a.playerAnswer = answers[i] ?? question.items.map((_, idx) => idx); a.correctOrder = question.correctOrder;
        }
        return a;
      });
      const finalScore = calculateScore(finalAnswers);
      if (user?.uid) await updateQuizStats(user.uid, finalScore.correct, finalScore.total);

      if (q.type === QUESTION_TYPES.VIDEO_MC) {
        // For video questions: let the clip finish playing first.
        // onVideoEnded (wired below) is the real trigger.
        // 90s fallback in case the video end event never fires.
        if (videoEndTimerRef.current) clearTimeout(videoEndTimerRef.current);
        videoEndTimerRef.current = setTimeout(() => setShowComplete(true), 90000);
      } else {
        // Non-video questions: show complete immediately
        setTimeout(() => setShowComplete(true), 600);
      }
    }
  };

  // Called when the YouTube clip finishes playing after the last VIDEO_MC answer
  const handleLastVideoEnded = () => {
    if (videoEndTimerRef.current) clearTimeout(videoEndTimerRef.current);
    setShowComplete(true);
  };

  const goNext = () => {
    // Cancel any pending video-end complete timer when navigating away
    if (videoEndTimerRef.current) { clearTimeout(videoEndTimerRef.current); videoEndTimerRef.current = null; }
    if (current < total - 1) { setCurrent(c => c + 1); resetQuestionPerkState(); }
    else setShowComplete(true);
  };
  const goPrev = () => {
    if (current > 0) { setCurrent(c => c - 1); resetQuestionPerkState(); }
  };

  // Score for complete screen
  const scoreAnswers = questions.map((question, i) => {
    const t = question.type === QUESTION_TYPES.VIDEO_MC ? QUESTION_TYPES.MULTI_CHOICE : question.type;
    const a = { type: t };
    if (question.type === QUESTION_TYPES.MULTI_CHOICE || question.type === QUESTION_TYPES.VIDEO_MC) {
      a.playerAnswer = answers[i]; a.correctIndex = question.correctIndex;
    } else if (question.type === QUESTION_TYPES.ENTER_VALUE) {
      a.playerAnswer = answers[i] ?? ""; a.correctAnswer = question.correctAnswer;
    } else if (question.type === QUESTION_TYPES.RANK) {
      a.playerAnswer = answers[i] ?? question.items.map((_, idx) => idx); a.correctOrder = question.correctOrder;
    }
    return a;
  });
  const score = calculateScore(scoreAnswers);

  // ── Complete Screen ─────────────────────────────────────────────────────────
  if (showComplete) {
    const pct = Math.round((score.correct / score.total) * 100);
    const getRank = () => {
      if (pct === 100) return { label: "Perfect Score!", color: "#f59e0b", icon: "★" };
      if (pct >= 80)   return { label: "Great Work!",   color: "#22c55e", icon: "✓" };
      if (pct >= 60)   return { label: "Not Bad!",      color: "#3b82f6", icon: "✓" };
      return               { label: "Keep Practising",  color: "#ef4444", icon: "○" };
    };
    const rank = getRank();
    return (
      <div className={`aqp-page ${isDark ? "dark" : "light"}`}>
        <div className="aqp-complete-wrap">
          <div className="aqp-complete-card">
            <div className="aqp-complete-icon">{rank.icon}</div>
            <h2 className="aqp-complete-title">Quiz Complete!</h2>
            <p className="aqp-complete-rank" style={{ color: rank.color }}>{rank.label}</p>

            {/* Score bar */}
            <div className="aqp-score-wrap">
              <div className="aqp-score-label">
                <span>Your Score</span>
                <span className="aqp-fraction">{score.correct} / {score.total}</span>
              </div>
              <div className="aqp-score-track">
                <div className="aqp-score-fill" style={{ width: `${pct}%`, background: rank.color }} />
              </div>
              <div className="aqp-score-pct">{pct}%</div>
            </div>

            {/* Per-question breakdown */}
            <div className="aqp-breakdown">
              {questions.map((question, i) => {
                const a = scoreAnswers[i];
                const wasCorrect = (() => {
                  if (a.type === QUESTION_TYPES.MULTI_CHOICE) return a.playerAnswer === a.correctIndex;
                  if (a.type === QUESTION_TYPES.ENTER_VALUE)  return isValueAnswerCorrect(a.playerAnswer, a.correctAnswer);
                  if (a.type === QUESTION_TYPES.RANK)         return isRankingCorrect(a.playerAnswer, a.correctOrder);
                  return false;
                })();
                return (
                  <div key={i} className={`aqp-bk-row ${wasCorrect ? "bk-correct" : "bk-wrong"}`}>
                    <span className="aqp-bk-num">Q{i + 1}</span>
                    <span className="aqp-bk-icon">{wasCorrect ? "✓" : "✗"}</span>
                    <span className="aqp-bk-text">
                      {question.question?.length > 55 ? question.question.slice(0, 55) + "…" : question.question}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="aqp-points-earned">+{score.points} XP earned</p>

            <div className="aqp-complete-actions">
              <button className="aqc-btn-primary" onClick={() => {
                if (canTryAgain(unlockedPerks) && !tryAgainUsed) handleTryAgain();
                else {
                  setShowComplete(false); setCurrent(0);
                  setAnswers(Array(total).fill(null)); setSubmitted(Array(total).fill(false));
                  resetQuestionPerkState(); setConsecutiveCorrect(0);
                }
              }}>
                {canTryAgain(unlockedPerks) && !tryAgainUsed ? "🔄 Try Again (perk)" : "Try Again"}
              </button>
              {/* Review — lets users stay and read comments/explanations */}
              <button className="aqc-btn-secondary" onClick={() => setShowComplete(false)}>
                Review Answers
              </button>
              <button className="aqc-btn-secondary" onClick={onBack}>Back to Quizzes</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Perk button visibility
  const showFiftyFiftyBtn  = isMC && sessionActivePerks.includes(PERK_KEY.FIFTY_FIFTY) && !isSubmitted;
  const showCoinTossBtn    = isMC && sessionActivePerks.includes(PERK_KEY.COIN_TOSS) && !isSubmitted && unlockedPerks.includes(PERK_KEY.COIN_TOSS);
  const showRevealWrongBtn = isMC && sessionActivePerks.includes(PERK_KEY.REVEAL_1_WRONG) && !isSubmitted;
  const showRetryQBtn      = unlockedPerks.includes(PERK_KEY.RETRY_QUESTION) && isSubmitted && !questionRetryUsed;
  const hasPerkBtns        = showFiftyFiftyBtn || showCoinTossBtn || showRevealWrongBtn || showRetryQBtn;

  return (
    <div className={`aqp-page ${isDark ? "dark" : "light"}`}>
      {/* Header */}
      <div className="aqp-header">
        <button className="aqp-back-btn" onClick={onBack}>Back</button>
        <h2 className="aqp-quiz-title">{quiz.title}</h2>
        <SkillPerksDropdown passivePerks={passivePerks} activePerks={activePerks}
          sessionActivePerks={sessionActivePerks} onToggle={toggleSessionPerk} isDark={isDark} />
      </div>

      {/* Progress dots */}
      <div className="aqp-progress-row">
        {questions.map((_, i) => (
          <span key={i} className={`aqp-dot ${i === current ? "active" : ""} ${submitted[i] ? "done" : ""}`} />
        ))}
        <span className="aqp-counter">{current + 1} / {total}</span>
      </div>

      {/* Centred content column — matches video/card width, clears nav */}
      <div className="aqp-content-col">

        {/* Perk buttons — inside column so they left-align with the card */}
        {hasPerkBtns && (
          <div className="perk-actions">
            {showFiftyFiftyBtn  && <button className="perk-btn fifty-fifty"  onClick={handleFiftyFifty}>½ 50/50</button>}
            {showCoinTossBtn    && <button className="perk-btn coin-toss"    onClick={handleFiftyFifty}>🪙 Coin Toss</button>}
            {showRevealWrongBtn && <button className="perk-btn reveal-wrong" onClick={handleReveal1Wrong}>🚫 Reveal Wrong</button>}
            {showRetryQBtn      && <button className="perk-btn retry-q"      onClick={handleRetryQuestion}>↩ Retry Question</button>}
          </div>
        )}

        {/* Question card */}
        <div className="aqp-question-card">
          <div className="aqp-q-header">
            <span className="aqp-q-badge">Q{current + 1}</span>
            <span className="aqp-q-type">{q?.type?.replace(/_/g, " ")}</span>
          </div>
          <p className="aqp-q-text">{q?.question}</p>

          {/* Question renderer — VideoMcPlayer has its own key so YT remounts */}
          {isVideoMC ? (
            <VideoMcPlayer
              key={`video-${quiz.id}-${current}`}
              question={q} answer={currAnswer} onAnswer={handleAnswer} submitted={isSubmitted}
              onVideoEnded={current === total - 1 ? handleLastVideoEnded : undefined}
              hiddenChoices={hiddenChoices} revealedWrong={revealedWrong} revealedCorrect={revealedCorrect}
            />
          ) : isMC ? (
            <MultiChoicePlayer
              question={q} answer={currAnswer} onAnswer={handleAnswer} submitted={isSubmitted}
              hiddenChoices={hiddenChoices} revealedWrong={revealedWrong} revealedCorrect={revealedCorrect}
            />
          ) : q?.type === QUESTION_TYPES.RANK ? (
            <RankPlayer question={q} answer={currAnswer} onAnswer={handleAnswer} submitted={isSubmitted} />
          ) : q?.type === QUESTION_TYPES.ENTER_VALUE ? (
            <EnterValuePlayer question={q} answer={currAnswer} onAnswer={handleAnswer} submitted={isSubmitted} />
          ) : (
            <p className="aqp-error-text">Unknown question type: {q?.type}</p>
          )}

          {/* Nav: Prev | Next | Submit ───────────────────────────────────── */}
          <div className="aqp-question-nav">
            <button className="aqc-btn-secondary" onClick={goPrev} disabled={current === 0}>
              ◀ Prev
            </button>

            {/* Next — always visible so players can skip and come back */}
            <button className="aqc-btn-secondary" onClick={goNext}>
              {current < total - 1 ? "Next ▶" : "See Results"}
            </button>

            {/* Submit — only when not yet submitted */}
            {!isSubmitted && (
              <button className="aqc-btn-primary" onClick={handleSubmit} disabled={!canSubmit()}>
                Submit
              </button>
            )}
            {isSubmitted && (
              <button className="aqc-btn-submitted" disabled>
                ✓ Submitted
              </button>
            )}
          </div>
        </div>

        {/* Per-question comment section — stays in the content column */}
        <QuizQuestionComments quizId={quiz.id} questionIndex={current} />
      </div>
    </div>
  );
}

// ── Inline quiz editor ────────────────────────────────────────────────────────
function AdminQuizEdit({ quiz, isDark, onSave, onCancel }) {
  const [title,     setTitle]     = useState(quiz.title ?? "");
  const [questions, setQuestions] = useState(quiz.questions ?? []);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const LABELS = ["A", "B", "C", "D", "E", "F"];
  const updateQ = (i, patch) => setQuestions(prev => prev.map((q, qi) => qi === i ? { ...q, ...patch } : q));
  const removeQ = (i) => setQuestions(prev => prev.filter((_, qi) => qi !== i));
  const handleSave = async () => {
    if (!title.trim()) { setError("Quiz title cannot be empty."); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, "adminQuizzes", quiz.id), { title: title.trim(), questions });
      onSave({ ...quiz, title: title.trim(), questions });
    } catch (err) { console.error(err); setError("Save failed. Please try again."); }
    finally { setSaving(false); }
  };
  return (
    <div className={`aqp-page ${isDark ? "dark" : "light"}`}>
      <div className="aqp-edit-wrap">
        <div className="aqp-edit-header">
          <h2 className="aqp-edit-title">Edit Quiz</h2>
          <button className="aqp-back-btn" onClick={onCancel}>Cancel</button>
        </div>
        <label className="aqp-edit-label">Quiz Title</label>
        <input className="aqp-edit-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiz title" />
        {questions.map((q, i) => (
          <div key={i} className="aqp-edit-qblock">
            <div className="aqp-edit-qheader">
              <span className="aqp-edit-qnum">Q{i + 1}</span>
              <span className="aqp-edit-qtype">{q.type?.replace(/_/g, " ")}</span>
              {questions.length > 1 && <button className="aqp-admin-btn delete" onClick={() => removeQ(i)}>Remove</button>}
            </div>
            <label className="aqp-edit-label">Question</label>
            <textarea className="aqp-edit-textarea" rows={2} value={q.question ?? ""} onChange={(e) => updateQ(i, { question: e.target.value })} />
            {(q.type === "multi_choice" || q.type === "video_mc") && (
              <>
                <label className="aqp-edit-label">Choices — click letter to mark correct</label>
                {(q.choices ?? []).map((choice, ci) => (
                  <div key={ci} className="aqp-edit-choice-row">
                    <button className={`aqp-edit-radio ${q.correctIndex === ci ? "correct" : ""}`} onClick={() => updateQ(i, { correctIndex: ci })}>{LABELS[ci]}</button>
                    <input className="aqp-edit-input" value={choice} onChange={(e) => { const u = [...(q.choices ?? [])]; u[ci] = e.target.value; updateQ(i, { choices: u }); }} />
                  </div>
                ))}
                <label className="aqp-edit-label">Explanation</label>
                <textarea className="aqp-edit-textarea" rows={2} value={q.reason ?? ""} onChange={(e) => updateQ(i, { reason: e.target.value })} />
              </>
            )}
            {q.type === "enter_value" && (
              <>
                <label className="aqp-edit-label">Correct Answer</label>
                <input className="aqp-edit-input" value={q.correctAnswer ?? ""} onChange={(e) => updateQ(i, { correctAnswer: e.target.value })} />
                <label className="aqp-edit-label">Explanation</label>
                <textarea className="aqp-edit-textarea" rows={2} value={q.reason ?? ""} onChange={(e) => updateQ(i, { reason: e.target.value })} />
              </>
            )}
            {q.type === "rank" && (
              <>
                <label className="aqp-edit-label">Item Labels</label>
                {(q.items ?? []).map((item, ii) => (
                  <div key={ii} className="aqp-edit-choice-row">
                    <span className="aqp-edit-rank-num">{ii + 1}</span>
                    <input className="aqp-edit-input" value={item.label ?? ""} onChange={(e) => { const u = [...(q.items ?? [])]; u[ii] = { ...u[ii], label: e.target.value }; updateQ(i, { items: u }); }} />
                  </div>
                ))}
                <label className="aqp-edit-label">Explanation</label>
                <textarea className="aqp-edit-textarea" rows={2} value={q.reason ?? ""} onChange={(e) => updateQ(i, { reason: e.target.value })} />
              </>
            )}
          </div>
        ))}
        {error && <p className="aqp-edit-error">{error}</p>}
        <div className="aqp-edit-actions">
          <button className="aqp-action-btn play" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
          <button className="aqp-action-btn classic" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function AdminQuizPage({ user }) {
  const { gameId } = useParams();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const game = GAME_META[gameId] ?? GAME_META.other;

  const [quizList,     setQuizList]     = useState([]);
  const [loadingList,  setLoadingList]  = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeQuiz,   setActiveQuiz]   = useState(null);
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [deletingId,   setDeletingId]   = useState(null);
  const [editingQuiz,  setEditingQuiz]  = useState(null);
  const [confirmId,    setConfirmId]    = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid)).then(snap => { if (snap.exists()) setIsAdmin(snap.data().isAdmin === true); }).catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    async function load() {
      setLoadingList(true);
      try {
        const snap = await getDocs(query(collection(db, "adminQuizzes"), where("game", "==", gameId), where("approved", "==", true)));
        setQuizList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error(err); } finally { setLoadingList(false); }
    }
    load();
  }, [gameId]);

  const handleDelete = async (quizId) => {
    setDeletingId(quizId);
    try {
      await deleteDoc(doc(db, "adminQuizzes", quizId));
      setQuizList(prev => prev.filter(q => q.id !== quizId)); setConfirmId(null);
    } catch (err) { console.error(err); } finally { setDeletingId(null); }
  };

  if (activeQuiz) return <AdminQuizPlayer quiz={activeQuiz} user={user} onBack={() => setActiveQuiz(null)} />;
  if (editingQuiz) return (
    <AdminQuizEdit quiz={editingQuiz} isDark={isDark}
      onSave={updated => { setQuizList(prev => prev.map(q => q.id === updated.id ? updated : q)); setEditingQuiz(null); }}
      onCancel={() => setEditingQuiz(null)} />
  );

  return (
    <div className={`aqp-landing ${isDark ? "dark" : "light"}`}>
      <div className="aqp-splash" style={{ backgroundImage: `url(${game.image})` }}>
        <div className="aqp-splash-overlay" />
        <div className="aqp-splash-content">
          <h1 className="aqp-splash-title" style={{ color: game.accent }}>{game.name}</h1>
          <p className="aqp-splash-desc">{game.description}</p>
        </div>
      </div>
      <div className="aqp-actions-row">
        <div className="aqp-play-wrap">
          <button className="aqp-action-btn play" onClick={() => setShowDropdown(v => !v)} disabled={loadingList}>
            {loadingList ? "Loading..." : "Play Quiz"}
          </button>
          {showDropdown && (
            <div className="aqp-quiz-dropdown">
              {quizList.length === 0 ? (
                <div className="aqp-dropdown-empty">No quizzes yet for {game.name}.</div>
              ) : quizList.map(quiz => (
                <div key={quiz.id} className="aqp-dropdown-row">
                  <button className="aqp-dropdown-item" onClick={() => { setActiveQuiz(quiz); setShowDropdown(false); }}>
                    <span className="aqp-dropdown-title">{quiz.title}</span>
                    <span className="aqp-dropdown-count">{quiz.questions?.length ?? 0} questions</span>
                  </button>
                  {isAdmin && (
                    <div className="aqp-dropdown-admin-btns">
                      <button className="aqp-admin-btn edit" onClick={e => { e.stopPropagation(); setShowDropdown(false); setEditingQuiz(quiz); }}>Edit</button>
                      <button className="aqp-admin-btn delete" onClick={e => { e.stopPropagation(); setConfirmId(quiz.id); }} disabled={deletingId === quiz.id}>{deletingId === quiz.id ? "..." : "Delete"}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {gameId === "valorant" && <button className="aqp-action-btn classic" onClick={() => navigate("/quiz/valorant")}>Classic Demo Quiz</button>}
        {isAdmin && <button className="aqp-action-btn create" onClick={() => navigate("/admin-quiz/create")}>Create Quiz</button>}
      </div>

      {!loadingList && quizList.length > 0 && (
        <div className={`aqp-quiz-grid ${isDark ? "dark" : "light"}`}>
          <h2 className="aqp-grid-title">Available Quizzes</h2>
          <div className="aqp-grid">
            {quizList.map(quiz => (
              <div key={quiz.id} className="aqp-quiz-card-wrap">
                <button className="aqp-quiz-card" onClick={() => setActiveQuiz(quiz)}>
                  <span className="aqp-qcard-title">{quiz.title}</span>
                  <span className="aqp-qcard-meta">{quiz.questions?.length ?? 0} questions</span>
                </button>
                {isAdmin && (
                  <div className="aqp-card-admin-row">
                    <button className="aqp-admin-btn edit" onClick={() => setEditingQuiz(quiz)}>Edit</button>
                    <button className="aqp-admin-btn delete" onClick={() => setConfirmId(quiz.id)} disabled={deletingId === quiz.id}>{deletingId === quiz.id ? "Deleting..." : "Delete"}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmId && (
        <div className="aqp-confirm-overlay" onClick={() => setConfirmId(null)}>
          <div className="aqp-confirm-box" onClick={e => e.stopPropagation()}>
            <h3 className="aqp-confirm-title">Delete Quiz?</h3>
            <p className="aqp-confirm-msg">This will permanently remove the quiz. This cannot be undone.</p>
            <div className="aqp-confirm-actions">
              <button className="aqp-admin-btn delete" onClick={() => handleDelete(confirmId)} disabled={!!deletingId}>{deletingId ? "Deleting..." : "Yes, Delete"}</button>
              <button className="aqp-admin-btn edit" onClick={() => setConfirmId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
