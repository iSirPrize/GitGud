// CritiquePage.jsx
// Drop into: gitgud-client/src/CritiquePage.jsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, query, where, getDocs
} from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import CritiquePost from "./CritiquePost";
import "./CritiquePage.css";

export const CRITIQUE_CATEGORIES = [
  { id: "all",       label: "All Posts" },
  { id: "wrong",     label: "What am I doing wrong?" },
  { id: "highlight", label: "Check this play out" },
];

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: Fetch ALL approved posts in one query (no compound index needed),
//         then sort + filter client-side.
//
// Root cause of the original bug:
//   • The query `where("approved","==",true) + orderBy("createdAt","desc")` and
//     the triple-condition variant both need Firestore composite indexes that
//     were never created.  Firestore silently returns 0 results (or throws an
//     index error in the console) when the index is missing, so approved posts
//     never appeared even after the admin clicked "Approve: Go Live".
//
//   • Fix: query only on `approved == true` (single-field index, auto-created),
//     then sort and filter in JavaScript.  No new Firestore index required.
// ─────────────────────────────────────────────────────────────────────────────

export default function CritiquePage({ user }) {
  const { theme }  = useTheme();
  const isDark     = theme === "dark";
  const navigate   = useNavigate();

  // All approved posts fetched once
  const [allPosts,  setAllPosts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [category,  setCategory]  = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Single-field query — no composite index needed
        const q    = query(
          collection(db, "critiquePosts"),
          where("approved", "==", true)
        );
        const snap = await getDocs(q);
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          // Sort by createdAt descending client-side
          .sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() ?? 0;
            const tb = b.createdAt?.toMillis?.() ?? 0;
            return tb - ta;
          });
        setAllPosts(docs);
      } catch (err) {
        console.error("Failed to load critique posts:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []); // load once; re-filter is purely client-side

  // Derive visible posts from the active tab filter
  const visiblePosts =
    category === "all"
      ? allPosts
      : allPosts.filter((p) => p.category === category);

  // For the "All Posts" view, split into two named sections
  const wrongPosts     = allPosts.filter((p) => p.category === "wrong");
  const highlightPosts = allPosts.filter((p) => p.category === "highlight");

  return (
    <div className={`cp-page quiz-carousel ${isDark ? "dark" : "light"}`}>

      {/* ── Header ── */}
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

      {/* ── Category filter tabs ── */}
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

      {/* ── Feed ── */}
      {loading ? (
        <div className="cp-loading">Loading posts…</div>
      ) : category === "all" ? (
        // ── FIX 2: "All Posts" renders TWO labelled sections ──────────────────
        <div className="cp-feed cp-feed--split">

          {/* Section 1 — What am I doing wrong? */}
          <section className="cp-section">
            <div className="cp-section-header">
              <h2 className="cp-section-title">What am I doing wrong?</h2>
              <span className="cp-section-count">{wrongPosts.length} post{wrongPosts.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="cp-section-divider" />

            {wrongPosts.length === 0 ? (
              <div className="cp-section-empty">
                <p>No posts yet — be the first to ask for help!</p>
                <button
                  className="cp-post-btn cp-post-btn--sm"
                  onClick={() => navigate("/critique/create")}
                >
                  Post a Clip
                </button>
              </div>
            ) : (
              <div className="cp-section-posts">
                {wrongPosts.map((post) => (
                  <CritiquePost key={post.id} post={post} user={user} />
                ))}
              </div>
            )}
          </section>

          {/* Section 2 — Check this play out */}
          <section className="cp-section">
            <div className="cp-section-header">
              <h2 className="cp-section-title">Check this play out</h2>
              <span className="cp-section-count">{highlightPosts.length} post{highlightPosts.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="cp-section-divider" />

            {highlightPosts.length === 0 ? (
              <div className="cp-section-empty">
                <p>No highlights yet — show the community your best plays!</p>
                <button
                  className="cp-post-btn cp-post-btn--sm"
                  onClick={() => navigate("/critique/create")}
                >
                  Post a Clip
                </button>
              </div>
            ) : (
              <div className="cp-section-posts">
                {highlightPosts.map((post) => (
                  <CritiquePost key={post.id} post={post} user={user} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        // ── Single-category filtered view ──────────────────────────────────
        visiblePosts.length === 0 ? (
          <div className="cp-empty">
            <p>No posts yet in this category.</p>
            <button className="cp-post-btn" onClick={() => navigate("/critique/create")}>
              Be the first to post
            </button>
          </div>
        ) : (
          <div className="cp-feed">
            {visiblePosts.map((post) => (
              <CritiquePost key={post.id} post={post} user={user} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
