// Category.jsx
// Game selection hub for admin-created quizzes.
//
// Each game card shows:
//   - Splash art
//   - Game name
//   - "Play Quiz" button  → /admin-quiz/:gameId (dropdown of admin quizzes)
//   - "Create Quiz" link  → /admin-quiz/create  (visible to admins only)
//
// The hardcoded 5-question Valorant demo quiz is preserved.
// It is accessible via the "Classic Demo Quiz" button on the AdminQuizPage
// (/admin-quiz/valorant), so nothing from the original flow is lost.
//
// SOLID:
//   S – Category only renders game cards and delegates everything else
//   O – Adding a new game means adding one entry to GAMES; no logic changes
//   D – Firestore isAdmin check is done inside AdminQuizPage, not here

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import "./Category.css";

const GAMES = [
  {
    id:          "valorant",
    name:        "Valorant",
    description: "Test your game sense on agent and map based scenarios",
    image:       "https://res.cloudinary.com/dyis0klmz/image/upload/v1777185621/ValorantSplash_siafhc.jpg",
    accent:      "#ff4655",
  },
  {
    id:          "cs2",
    name:        "Counter-Strike 2",
    description: "Master economy, utility, and tactical positioning",
    image:       "https://res.cloudinary.com/dyis0klmz/image/upload/v1777185626/CS2Spalsh_sg4smz.jpg",
    accent:      "#eeb02a",
  },
  {
    id:          "fortnite",
    name:        "Fortnite",
    description: "Test your Fortnite knowledge on weapons, POIs, and game mechanics",
    image:       "https://res.cloudinary.com/dyis0klmz/image/upload/v1748997619/FortniteChapter2_Reloaded_kkqgad.jpg",
    accent:      "#00d4ff",
  },
  {
    id:          "other",
    name:        "Other Games",
    description: "Apex, Overwatch, Valorant and more",
    image:       "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop",
    accent:      "#a855f7",
  },
];

const Category = ({ user }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status once on mount
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (snap.exists()) setIsAdmin(snap.data().isAdmin === true);
      })
      .catch(() => {});
  }, [user?.uid]);

  return (
    <div className={`category-page quiz-carousel ${isDark ? "dark" : "light"}`}>
      <div className="category-header">
        <h1>Select Your Game</h1>
        <div className="header-underline" />
      </div>

      <div className="games-grid">
        {GAMES.map((game) => (
          <div
            key={game.id}
            className={`game-card ${game.id}`}
            style={{ "--game-accent": game.accent }}
          >
            {/* Splash image */}
            <div className="card-image-container">
              <img src={game.image} alt={game.name} />
              <div className="card-overlay" />
            </div>

            {/* Content */}
            <div className="card-content">
              <h2>{game.name}</h2>
              <p>{game.description}</p>

              {/* Action buttons */}
              <div className="card-actions">
                <button
                  className="card-action-btn play"
                  onClick={() => navigate(`/admin-quiz/${game.id}`)}
                >
                  Play Quiz
                </button>

                {isAdmin && (
                  <button
                    className="card-action-btn create"
                    onClick={() => navigate("/admin-quiz/create")}
                  >
                    Create Quiz
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Category;
