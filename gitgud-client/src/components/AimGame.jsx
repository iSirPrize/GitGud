import { useState, useEffect, useRef } from "react";
import "./AimGame.css";
import { useTheme } from '../context/ThemeContext';
import { db, auth } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function AimGame() {
    const GAME_TIME = 15

const [score, setScore] = useState(0);
const [timeLeft, setTimeLeft] = useState(GAME_TIME);
const [target, setTarget] = useState({ x: 50, y: 50});
const [gameActive, setGameActive] = useState(false);
const [clicks, setClicks] = useState(0);
const [result, setResult] = useState(null);
const [crosshairType, setCrosshairType] = useState("plus");
const [crosshairColor, setCrosshairColor] = useState("#ffffff");
const [inGame, setInGame] = useState(false);
const { theme } = useTheme();
const scoreRef = useRef(score);
const clicksRef = useRef(clicks);
const gameEndedRef = useRef(false);

//Below will spawn the targets randomly, adjusted later 
const spawnTarget = () => { 
  const x = Math.random() * 90;

  // Left side higher (75%), right side lower (50%)
  const maxY = 75 - (x / 90) * 25;

  const y = Math.random() * maxY;

  setTarget({ x, y });
};

//For when the target is clicked
const handleTargetClick = () => {
    if (!gameActive) return;

    playShootSound();

    // delay hit sound slightly
    const delay = 50 + Math.random() * 30;

    setTimeout(() => {
        playHitSound();
    }, delay);

    setScore((prev) => prev + 1);
    setClicks((prev) => prev + 1);
    spawnTarget();
};

//Track misses, for calculating average accuracy
const handleMisses = () => {
    if (!gameActive) return;
    setClicks((prev) => prev + 1);
};

//score and clicks logic keeps the refs updated
useEffect(() => {
  scoreRef.current = score;
  clicksRef.current = clicks;
}, [score, clicks]);

//Timer logic
useEffect(() => {

    if (!gameActive) { 
        return;
    }

      const timer = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(timer);
        endGame(scoreRef.current, clicksRef.current);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [gameActive]);

//When game has started
const startGame = () => {
    gameEndedRef.current = false; //reset

    setScore(0);
    setClicks(0);
    setTimeLeft(GAME_TIME);
    setGameActive(true);
    spawnTarget();
}

//gun shot sound pool
const gunSounds = [
    "/sounds/Gun sound 1.m4a",
    "/sounds/Gun sound 2.m4a",
    "/sounds/Gun sound 3.m4a",
    "/sounds/Gun sound 4.m4a",
]

const playShootSound = () => {
    const src = gunSounds[Math.floor(Math.random() * gunSounds.length)];
    const sound = new Audio(src);

    sound.volume = 0.1 + Math.random() * 0.2;
    sound.play();
};

//Target hit sound effects sounds pool
const hitSounds = [
    "/sounds/hit EFX 1.m4a",
    "/sounds/hit EFX 2.m4a",
    "/sounds/hit EFX 3.m4a",
    "/sounds/hit EFX 4.m4a",
];

const playHitSound = () => {
    const src = hitSounds[Math.floor(Math.random() * hitSounds.length)];
    const sound = new Audio(src);

    sound.volume = 0.1 + Math.random() * 0.2;
    sound.play();
};

//When game has ended (will adjust once firebase has been set up)
const endGame = async (finalScore, finalClicks) => {
    if (gameEndedRef.current) {
        return; //was running into issue where it was creating duplicate scores for the same game
    }
    gameEndedRef.current = true;
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
    createdAt: serverTimestamp(),
  };

  setResult(resultData); 

  console.log("Aim Trainer Results:", resultData);

  //save to firebase

  try {
    const user = auth.currentUser;

    await addDoc(collection(db, "aimResults"), {
        userId: user ? user.uid : "guest",
        username: user?.displayName || "Anonymous",
        ...resultData,
    });

    console.log("Saved to Firebase");
  } catch (error) {
    console.error("Error saving result:", error);
  }
};

const getCursor = () => {
    if (!inGame) {
        return "default";
    }

    const color = crosshairColor.replace("#", "%23");

    switch(crosshairType) {
        case "plus":
            return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><line x1='20' y1='6' x2='20' y2='34' stroke='${color}' stroke-width='2'/><line x1='6' y1='20' x2='34' y2='20' stroke='${color}' stroke-width='2'/></svg>") 20 20, crosshair`;

    case "x":
      return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><line x1='8' y1='8' x2='32' y2='32' stroke='${color}' stroke-width='2'/><line x1='32' y1='8' x2='8' y2='32' stroke='${color}' stroke-width='2'/></svg>") 20 20, crosshair`;

    case "dotCross":
      return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='3' fill='${color}'/><line x1='20' y1='6' x2='20' y2='14' stroke='${color}' stroke-width='2'/><line x1='20' y1='26' x2='20' y2='34' stroke='${color}' stroke-width='2'/><line x1='6' y1='20' x2='14' y2='20' stroke='${color}' stroke-width='2'/><line x1='26' y1='20' x2='34' y2='20' stroke='${color}' stroke-width='2'/></svg>") 20 20, crosshair`;

    case "dot":
      return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='4' fill='${color}'/></svg>") 20 20, crosshair`;

    default:
      return "crosshair";
    }
}
console.log("theme =", theme);
return (
    <div className={`quiz-carousel ${theme?.toLowerCase?.()}`}>
    <div className="aim-container">
        <div className="aim-layout">

        {/* Game */}
    <div className="aim-gamebox"
        onMouseEnter={() => setInGame(true)}
        onMouseLeave={() => setInGame(false)}
        onClick={() => {
            if (!gameActive) return;

                playShootSound();
                handleMisses();   
            }}
        style={{
            position: "relative",
            overflow: "hidden",
            border: "3px solid var(--qc-frame)",
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
            width: "75px",
            height: "75px",
            borderRadius: "50%",
            zIndex: 5,
            background: `radial-gradient(circle,
                        var(--qc-frame) 0%,
                        var(--qc-frame) 20%,
                        white 20%,
                        white 35%,
                        var(--qc-frame) 35%,
                        var(--qc-frame) 55%,
                        white 55%,
                        white 70%,
                        var(--qc-text) 70%,
                        var(--qc-text) 100%
                        )`,
            boxShadow: "0 0 15px var(--qc-frame)",
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
            <button  className={`option-btn ${crosshairType === "plus" ? "active" : ""}`} 
            onClick={() => setCrosshairType("plus")}
            >
                +
                </button>
            <button  className={`option-btn ${crosshairType === "x" ? "active" : ""}`}
            onClick={() => setCrosshairType("x")}
            >
                X
            </button>
            <button  className={`option-btn ${crosshairType === "dot" ? "active" : ""}`} 
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
        </div>
  );
}