// DarkModeToggle.jsx
import { useTheme } from "../context/ThemeContext";

function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme}>
      {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
    </button>
  );
}

export default DarkModeToggle;