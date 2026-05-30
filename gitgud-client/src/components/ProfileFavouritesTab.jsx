// src/components/ProfileFavouritesTab.jsx
import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import { subscribeClipFavourites } from "./clipFavourites";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import "./ProfileFavouritesTab.css";

export default function ProfileFavouritesTab({ uidProp }) {
  const uid = uidProp || auth.currentUser?.uid;
  const navigate = useNavigate();
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setClips([]);
      setLoading(false);
      return;
    }
    const unsub = subscribeClipFavourites(uid, (items) => {
      console.log("Favourite items:", items);
      setClips(items);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  if (loading) return <div>Loading favourites...</div>;
  if (!uid) return <div>Please sign in to see your favourite clips.</div>;
  if (clips.length === 0) return <div>No favourite clips yet.</div>;

 return (
  <div className="fav-clips-grid">
    {clips.map((c) => (
      <div
        key={c.id}
        className="fav-clip-card"
        onClick={() => { console.log("Navigating to:", c.videoPath);
          navigate(c.videoPath || `/quiz/${c.id}`);
}}
      >
        {c.thumbnail && (
          <img
            src={c.thumbnail}
            alt={c.title}
            className="fav-clip-thumb"
          />
        )}

        <div className="fav-clip-info">
          <div className="fav-clip-title">
            {c.title || "Untitled clip"}
          </div>

          <div className="fav-clip-game">
            {c.game || "Quiz Clip"}
          </div>
        </div>
      </div>
    ))}
  </div>
);
}
