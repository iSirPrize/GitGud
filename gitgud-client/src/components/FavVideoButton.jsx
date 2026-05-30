// src/components/FavVideoButton.jsx
import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import { addClipFavorite, removeClipFavorite, clipIsFavorited } from "./clipFavourites";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

export default function FavVideoButton({ clip }) {
  const uid = auth.currentUser?.uid;
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === "dark";

  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(true);

if (!clip || !clip.id) {
  return null;
}

  useEffect(() => {
    let mounted = true;
    if (!uid) {
      setIsFav(false);
      setLoading(false);
      return;
    }

    clipIsFavorited(uid, clip.id)
      .then((exists) => {
        if (mounted) {
          setIsFav(exists);
          setLoading(false);
        }
      })
      .catch(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [uid, clip.id]);

  const handleClick = async (e) => {
    e.stopPropagation();

    if (!uid) {
      // replace with your own auth / login route
      return navigate("/login");
    }

    try {
      setLoading(true);
      if (isFav) {
        await removeClipFavorite(uid, clip.id);
        setIsFav(false);
      } else {
        await addClipFavorite(uid, clip);
        setIsFav(true);
        console.log("Saving favourite path:", clip.videoPath);
      }
    } catch (err) {
      console.error("Favourite toggle failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const accent = dark ? "#ff6a00" : "#0066cc";

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        border: `1px solid ${accent}`,
        background: isFav
          ? dark
            ? "rgba(255,106,0,0.15)"
            : "rgba(0,102,204,0.12)"
          : "transparent",
        color: accent,
        fontSize: 13,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: loading ? "default" : "pointer",
        transition: "background 0.18s ease, transform 0.1s ease",
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill={isFav ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 
                 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 
                 5.5 0 0 0 0-7.78z" />
      </svg>
      <span>
        {loading
          ? "Saving..."
          : isFav
          ? "✓ Favourited"
          : "Favourite this video"}
      </span>
    </button>
  );
}
