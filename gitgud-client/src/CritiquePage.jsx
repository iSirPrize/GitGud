// CritiquePage.jsx
// Drop into: gitgud-client/src/CritiquePage.jsx
//
// INVEST:
//   I – No: relies on auth + CommentSection already working (both done)
//   N – Yes: categories, sorting, pagination all negotiable
//   V – Yes: community feedback is core to player improvement
//   E – Yes: mirrors UserQuizPage structure, clear scope
//   S – Yes: given auth + comments exist, this is UI + Firestore reads only
//   T – Yes: Gherkin tests below
//
// Gherkin:
//   Given the user clicks "User Critique" in the sidebar
//   When the CritiquePage loads
//   Then a feed of approved community video posts is shown
//   And a "Post a Clip" button is visible at the top
//
//   Given the feed loads
//   When the user selects the "What am I doing wrong?" category filter
//   Then only posts with that category are shown
//
//   Given an approved post exists
//   When the user scrolls the feed
//   Then the post shows the video thumbnail, title, creator, category badge, and like/dislike counts

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, query, where, orderBy, getDocs
} from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import CritiquePost from "./CritiquePost";
import "./CritiquePage.css";

export const CRITIQUE_CATEGORIES = [
  { id: "all",      label: "All Posts" },
  { id: "wrong",    label: "What am I doing wrong?" },
  { id: "highlight", label: "Check this play out" },
];

export default function CritiquePage({ user }) {
  const { theme }   = useTheme();
  const isDark      = theme === "dark";
  const navigate    = useNavigate();

  const [posts,    setPosts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [category, setCategory] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let q;
        if (category === "all") {
          q = query(
            collection(db, "critiquePosts"),
            where("approved", "==", true),
            orderBy("createdAt", "desc")
          );
        } else {
          q = query(
            collection(db, "critiquePosts"),
            where("approved", "==", true),
            where("category", "==", category),
            orderBy("createdAt", "desc")
          );
        }
        const snap = await getDocs(q);
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load critique posts:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [category]);

  return (
    <div className={`cp-page quiz-carousel ${isDark ? "dark" : "light"}`}>

      {/* Header */}
      <div className="cp-header">
        <h1 className="cp-title">User Critique</h1>
        <p className="cp-subtitle">
          Post your gameplay clips and get honest feedback from the community
        </p>
        <div className="cp-underline" />
        <button className="cp-post-btn" onClick={() => navigate("/critique/create")}>
          Post a Clip
        </button>
      </div>

      {/* Category filter tabs */}
      <div className="cp-tabs">
        {CRITIQUE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`cp-tab ${category === cat.id ? "active" : ""}`}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="cp-loading">Loading posts…</div>
      ) : posts.length === 0 ? (
        <div className="cp-empty">
          <p>No posts yet in this category.</p>
          <button className="cp-post-btn" onClick={() => navigate("/critique/create")}>
            Be the first to post
          </button>
        </div>
      ) : (
        <div className="cp-feed">
          {posts.map((post) => (
            <CritiquePost key={post.id} post={post} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}
