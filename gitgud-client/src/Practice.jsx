import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "./context/ThemeContext";
import { useState } from "react";
import AimGame from "./components/AimGame";
import "./AimTrainer.css";


function Practice() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [selectedMode, setSelectedMode] = useState(null);

  return (
    <div className={`aimtrainer-page quiz-carousel ${theme}`}>

      {/* Header */}
      <div className="aimtrainer-header">
        <button
          onClick={() => navigate("/")}
          className="back-button"
        >
          ← Back To Home
        </button>

        <h1>Select Your Practice Mode</h1>
        <div className="header-underline"></div>
      </div>

      {/* Mode Selection */}
      <div className="games-grid">

  {/* Aim Trainer */}
  <Link
    to="/practice/aim"
    className="game-card aim"
  >
    <div className="card-image-container">
      <img src="/AimTrainerTN.png" alt="Aim Trainer" />
    </div>

    <div className="card-content">
      <h2>Aim Trainer</h2>
      <p>Bad Aim? Improve your flicks and accuracy our aim trainer, customise your own crosshair to your liking and aim for the highest score! Time to GitGud</p>
    </div>
  </Link>

  {/* Reaction Trainer (disabled) */}
  <div className="game-card disabled">
    <div className="card-image-container">
      <img src="/ReactionTrainerTN.png" alt="Reaction Trainer" />
    </div>

    <div className="card-content">
      <h2>Reaction Trainer</h2>
      <p>Slow reactions? Test your reaction speed and improve it, shoot the enemies but be careful not to shoot civilians :p</p>
      <span className="coming-soon">Coming Soon</span>
    </div>
  </div>

</div>

      {/* Optional helper text */}
      {!selectedMode && (
        <p className="select-text">Select a mode to begin</p>
      )}

      {/* Game */}
      {selectedMode === "aim" && (
        <div className="aimtrainer-container">
          <AimGame />
        </div>
      )}

    </div>
  );
}

export default Practice;