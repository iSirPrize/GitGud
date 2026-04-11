import { useState, useEffect } from "react";
import "./AimGame.css";

export default function AimGame() {
    const GAME_TIME = 30

const [score, setScore] = useState(0);
const [timeLeft, setTimeLeft] = useState(GAME_TIME);
const [target, setTarget] = useState({ x: 50, y: 50});
const [gameActive, setGameActive] = useState(false);
const [clicks, setClicks] = useState(0);
const [result, setResult] = useState(null);
const [crosshairType, setCrosshairType] = useState("plus");
const [crosshairColor, setCrosshairColor] = useState("#ffffff");
const [inGame, setInGame] = useState(false);

//Below will spawn the targets randomly
const spawnTarget = () => { 
    setTarget({
        x: Math.random() * 90,
        y: Math.random() * 90,
    });
};

//For when the target is clicked
const handleTargetClick = () => {
    if (!gameActive) return;

    setScore((prev) => prev + 1);
    setClicks((prev) => prev + 1);
    spawnTarget();
};

//Track misses, for calculating average accuracy
const handleMisses = () => {
    if (!gameActive) return;
    setClicks((prev) => prev + 1);
};

//Timer logic
useEffect(() => {

    if (!gameActive) { 
        return;
    }

    if (timeLeft === 0) {
        endGame(score, clicks);
        return;
    }

    const timer = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
}, [timeLeft, gameActive]);

//When game has started
const startGame = () => {
    setScore(0);
    setClicks(0);
    setTimeLeft(GAME_TIME);
    setGameActive(true);
    spawnTarget();
}

//When game has ended (will adjust once firebase has been set up)
const endGame = (finalScore, finalClicks) => {
    setGameActive(false);

    //calculates the misses
    const misses = finalClicks - finalScore;

    // calculate accuracy
    const accuracy =
        finalClicks === 0 ? 0 : Math.round((finalScore / finalClicks) * 100);

  const resultData = {
    hits: finalScore,
    misses,
    accuracy,
    duration: GAME_TIME,
    date: new Date(),
  };

  setResult(resultData); 

  console.log("Aim Trainer Results:", resultData);
};

const getCursor = () => {
    if (!inGame) {
        return "default";
    }

    const color = crosshairColor.replace("#", "%23");

    switch(crosshairType) {
        case "plus":
            return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><line x1='32' y1='8' x2='32' y2='56' stroke='${color}' stroke-width='3'/><line x1='8' y1='32' x2='56' y2='32' stroke='${color}' stroke-width='3'/></svg>") 32 32, crosshair`;

    case "x":
      return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><line x1='12' y1='12' x2='52' y2='52' stroke='${color}' stroke-width='3'/><line x1='52' y1='12' x2='12' y2='52' stroke='${color}' stroke-width='3'/></svg>") 32 32, crosshair`;

    case "dotCross":
      return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><circle cx='32' cy='32' r='4' fill='${color}'/><line x1='32' y1='8' x2='32' y2='20' stroke='${color}' stroke-width='2'/><line x1='32' y1='44' x2='32' y2='56' stroke='${color}' stroke-width='2'/><line x1='8' y1='32' x2='20' y2='32' stroke='${color}' stroke-width='2'/><line x1='44' y1='32' x2='56' y2='32' stroke='${color}' stroke-width='2'/></svg>") 32 32, crosshair`;

    case "dot":
      return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><circle cx='32' cy='32' r='6' fill='${color}'/></svg>") 32 32, crosshair`;

    default:
      return "crosshair";
    }
}

return (
    <div className="aim-container">
        <div className="aim-layout">

        {/* Game */}
    <div className="aim-gamebox"
        onMouseEnter={() => setInGame(true)}
        onMouseLeave={() => setInGame(false)}
        onClick={handleMisses}
        style={{
            width: "80%",
            height: "90vh",
            margin: "0 auto",
            display: "block",
            position: "relative",
            overflow: "hidden",
            border: "3px solid #333",
            borderRadius: "12px",
            backgroundImage: "url('/mirage.png')",
            cursor: getCursor(),
            backgroundSize: "cover",
            backgroundPosition: "center",
        }}
        >

            {/* HUD */}
      <div className="aim-hud">
        <h2>Score: {score}</h2>
        <h3>Time: {timeLeft}</h3>

        {!gameActive && !result && (
          <button onClick={startGame}>Start Game</button>
        )}
      </div>

      {/* Targets */}
      {gameActive && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleTargetClick();
          }}
          style={{
            position: "absolute",
            top: `${target.y}%`,
            left: `${target.x}%`,
            width: "50px",
            height: "50px",
            backgroundColor: "red",
            borderRadius: "50%",
            zIndex: 5,
            boxShadow: "0 0 15px red",
            border: "2px solid white",
          }}
        />
      )}

      {/* Results */}
      {!gameActive && result && (
        <div className="aim-results">
          <h2>Results</h2>
          <p>Targets Hit: {result.hits}</p>
          <p>Targets Missed: {result.misses}</p>
          <p>Accuracy: {result.accuracy}%</p>

          <button onClick={startGame} style={{ marginTop: "10px" }}>
            Play Again
          </button>
        </div>
      )}
        </div>

    <div className="aim-menu">
        <h3>Crosshair Settings</h3>
        {/*Crosshair Type*/}
        <div className="crosshair-options">
            <button  className={`option-btn ${crosshairType === "dotCross" ? "active" : ""}`} 
                     onClick={() => setCrosshairType("dotCross")}
                     >
                        Default
                        </button>
            <button  className={`option-btn ${crosshairType === "+" ? "active" : ""}`} 
            onClick={() => setCrosshairType("plus")}
            >
                +
                </button>
            <button  className={`option-btn ${crosshairType === "x" ? "active" : ""}`}
            onClick={() => setCrosshairType("x")}
            >
                X
            </button>
            <button  className={`option-btn ${crosshairType === "x" ? "active" : ""}`} 
            onClick={() => setCrosshairType("dot")}
            >
                •
            </button>
        </div>
            {/*Colour Buttons*/}
            <button className={`option-btn ${crosshairColor === "#000000" ? "active" : ""}`}
                    onClick={() => setCrosshairColor("#000000")}>Black</button>
            <button className={`option-btn ${crosshairColor === "#ffffff" ? "active" : ""}`}
                    onClick={() => setCrosshairColor("#ffffff")}>White</button>
            <button className={`option-btn ${crosshairColor === "#00ff00" ? "active" : ""}`}
                    onClick={() => setCrosshairColor("#00ff00")}>Green</button>
            <button className={`option-btn ${crosshairColor === "#0000ff" ? "active" : ""}`}
                    onClick={() => setCrosshairColor("#0000ff")}>Blue</button>
        </div>
    </div>
        </div>
  );
}