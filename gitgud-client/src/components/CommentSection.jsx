import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

function CommentSection({ quizId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [user, setUser] = useState(null);

  // Track auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Listen to comments for this specific quiz in real time
  useEffect(() => {
    if (!quizId) return;
    const q = query(
      collection(db, "quizComments", String(quizId), "comments"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [quizId]);

  const handleSubmit = async () => {
    if (!text.trim() || !user) return;
    await addDoc(
      collection(db, "quizComments", String(quizId), "comments"),
      {
        text: text.trim(),
        userId: user.uid,
        userName: user.displayName || user.email?.split("@")[0] || "User",
        userPhoto: user.photoURL || null,
        createdAt: serverTimestamp(),
      }
    );
    setText("");
  };

  return (
    <div className="comment-section">
      <h3 className="comment-heading">Comments</h3>

      {/* Comment list */}
      <div className="comment-list">
        {comments.length === 0 && (
          <p className="comment-empty">No comments yet. Be the first!</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="comment-item">
            <div className="comment-avatar">
              {c.userPhoto ? (
                <img src={c.userPhoto} alt={c.userName} />
              ) : (
                <div className="comment-avatar-placeholder">
                  {c.userName?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>
            <div className="comment-body">
              <span className="comment-username">{c.userName}</span>
              <p className="comment-text">{c.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      {user ? (
        <div className="comment-input-row">
          <div className="comment-avatar">
            {user.photoURL ? (
              <img src={user.photoURL} alt="You" />
            ) : (
              <div className="comment-avatar-placeholder">
                {(user.displayName || user.email)?.[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>
          <input
            className="comment-input"
            type="text"
            placeholder="Add a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <button
            className="comment-submit"
            onClick={handleSubmit}
            disabled={!text.trim()}
          >
            Post
          </button>
        </div>
      ) : (
        <p className="comment-login-prompt">
          <a href="/auth">Log in</a> to leave a comment.
        </p>
      )}
    </div>
  );
}

export default CommentSection;