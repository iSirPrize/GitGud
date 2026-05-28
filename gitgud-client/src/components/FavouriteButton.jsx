import React from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const HeartIcon = ({ filled }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export default function FavouriteButton({ active = false, onClick }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const accent = dark ? "#ff6a00" : "#0066cc";
  const bg = dark ? "rgba(255,106,0,0.1)" : "rgba(0,102,204,0.08)";
  const border = dark ? "rgba(255,106,0,0.3)" : "rgba(0,102,204,0.25)";
  const navigate = useNavigate();

  const handle = (e) => {
    e.stopPropagation();
    if (onClick) return onClick(e);
    navigate(`/profile/${"me"}?tab=favourites`);
  };

  return (
    <button
      onClick={handle}
      title="Favourites"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: `1.5px solid ${border}`,
        background: bg,
        color: accent,
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,106,0,0.2)' : 'rgba(0,102,204,0.15)'; e.currentTarget.style.borderColor = accent }}
      onMouseLeave={e => { e.currentTarget.style.background = bg; e.currentTarget.style.borderColor = border }}
    >
      <HeartIcon filled={active} />
    </button>
  );
}
