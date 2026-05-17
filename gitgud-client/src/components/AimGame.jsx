import { useState, useEffect, useRef } from "react";
import "./AimGame.css";
import { useTheme } from "../context/ThemeContext";
import { db, auth } from "../firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";

export default function AimGame() {
  const GAME_TIME = 30;
  const { theme } = useTheme();

  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [target, setTarget] = useState({ x: 50, y: 50 });
  const [gameActive, setGameActive] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [result, setResult] = useState(null);
  const [crosshairType, setCrosshairType] = useState("plus");
  const [crosshairColor, setCrosshairColor] = useState("#ffffff");
  const [inGame, setInGame] = useState(false);

  const scoreRef = useRef(score);
  const clicksRef = useRef(clicks);
  const gameEndedRef = useRef(false);

  const crosshairSymbols = {
  dotCross: "✚",
  plus: "＋",
  x: "✖",
  dot: "●",
};

  const maps = [
    "/mirage.png",
    "/dust2.png",
    "/ancient.png",
    "/ascent.png",
    "/haven.png",
    "/bind.png",
  ];

  const [currentMap, setCurrentMap] = useState(() =>
    maps[Math.floor(Math.random() * maps.length)]
  );

  function spawnTarget() {
    const x = 10 + Math.random() * 80;
    const y = 20 + Math.random() * 60;
    setTarget({ x, y });
  }

  const handleTargetClick = () => {
    if (!gameActive) return;
    playShootSound();
    setTimeout(() => playHitSound(), 50 + Math.random() * 30);
    setScore((s) => s + 1);
    setClicks((c) => c + 1);
    spawnTarget();
  };

  const handleMisses = () => {
    if (gameActive) setClicks((c) => c + 1);
  };

  useEffect(() => {
    scoreRef.current = score;
    clicksRef.current = clicks;
  }, [score, clicks]);

  useEffect(() => {
    if (!gameActive) return;
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

  const startGame = () => {
    gameEndedRef.current = false;
    let next = currentMap;
    while (maps.length > 1 && next === currentMap) {
      next = maps[Math.floor(Math.random() * maps.length)];
    }
    setCurrentMap(next);
    setScore(0);
    setClicks(0);
    setTimeLeft(GAME_TIME);
    setResult(null);
    setGameActive(true);
    spawnTarget();
  };

  const gunSounds = [
    "/sounds/Gun sound 1.m4a",
    "/sounds/Gun sound 2.m4a",
    "/sounds/Gun sound 3.m4a",
    "/sounds/Gun sound 4.m4a",
  ];

  const playShootSound = () => {
    const src = gunSounds[Math.floor(Math.random() * gunSounds.length)];
    const a = new Audio(src);
    a.volume = 0.1 + Math.random() * 0.2;
    a.play();
  };

  const hitSounds = [
    "/sounds/hit EFX 1.m4a",
    "/sounds/hit EFX 2.m4a",
    "/sounds/hit EFX 3.m4a",
    "/sounds/hit EFX 4.m4a",
  ];

  const playHitSound = () => {
    const src = hitSounds[Math.floor(Math.random() * hitSounds.length)];
    const a = new Audio(src);
    a.volume = 0.1 + Math.random() * 0.2;
    a.play();
  };

  async function endGame(finalScore, finalClicks) {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    setGameActive(false);

    const misses = finalClicks - finalScore;
    const accuracy =
      finalClicks === 0 ? 0 : Number(((finalScore / finalClicks) * 100).toFixed(2));

    const resultData = {
      hits: finalScore,
      misses,
      accuracy,
      duration: GAME_TIME,
      createdAt: serverTimestamp(),
    };

    setResult(resultData);

    try {
      const user = auth.currentUser;
      let username = user?.displayName || "Anonymous";
      let photoURL = user?.photoURL || "";

      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const d = snap.data();
          username = d.username || d.displayName || username;
          photoURL = d.photoURL || photoURL;
        }
      }

      await addDoc(collection(db, "aimResults"), {
        userId: user ? user.uid : "guest",
        username,
        photoURL,
        ...resultData,
      });
    } catch (e) {
      console.error("Error saving aim result:", e);
    }
  }

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

  return (
    <div className={`aim-page ${theme}`}>

  <div className="aim-header">
    <h1>Aim Trainer</h1>
    <p>Click targets quickly to improve your aim.</p>
  </div>

  <div className="aim-wrapper">

    {/* SETTINGS PANEL */}
    <div className="aim-settings">

      <div className="aim-setting-card">
        <span className="aim-setting-label">Type</span>
        <span className="aim-setting-value">{crosshairSymbols[crosshairType]}</span>

      </div>

      <div className="aim-setting-card">
        <span className="aim-setting-label">Color</span>
        <span className="aim-setting-value">
          <div style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: crosshairColor,
            border: "1px solid var(--qc-frame)"
          }} />
        </span>
      </div>

      <div className="aim-controls">

        <button
  className={`aim-option-btn ${crosshairType === "dotCross" ? "active" : ""}`}
  onClick={() => setCrosshairType("dotCross")}
>
  ✚
</button>

<button
  className={`aim-option-btn ${crosshairType === "plus" ? "active" : ""}`}
  onClick={() => setCrosshairType("plus")}
>
  ＋
</button>

<button
  className={`aim-option-btn ${crosshairType === "x" ? "active" : ""}`}
  onClick={() => setCrosshairType("x")}
>
  ✖
</button>

<button
  className={`aim-option-btn ${crosshairType === "dot" ? "active" : ""}`}
  onClick={() => setCrosshairType("dot")}
>
  ●
</button>


        <button className={`aim-option-btn ${crosshairColor === "#000000" ? "active" : ""}`}
          onClick={() => setCrosshairColor("#000000")}>Black</button>

        <button className={`aim-option-btn ${crosshairColor === "#ffffff" ? "active" : ""}`}
          onClick={() => setCrosshairColor("#ffffff")}>White</button>

        <button className={`aim-option-btn ${crosshairColor === "#00ff00" ? "active" : ""}`}
          onClick={() => setCrosshairColor("#00ff00")}>Green</button>

        <button className={`aim-option-btn ${crosshairColor === "#0000ff" ? "active" : ""}`}
          onClick={() => setCrosshairColor("#0000ff")}>Blue</button>

      </div>
    </div>

    {/* GAME AREA */}
    <div
      className="aim-game"
      onMouseEnter={() => setInGame(true)}
      onMouseLeave={() => setInGame(false)}
      onClick={() => {
        if (!gameActive) return;
        playShootSound();
        handleMisses();
      }}
      style={{
        backgroundImage: `url('${currentMap}')`,
        cursor: getCursor(),
      }}
    >

      <div className="aim-hud">
        <h2>Score: {score}</h2>
        <h3>Time: {timeLeft}</h3>

        {!gameActive && !result && (
          <div className="aim-start-overlay">
            <div className="start-box">
              <h2>Aim Trainer</h2>
              <button onClick={startGame}>Start Game</button>
            </div>
          </div>
        )}
      </div>

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
            background: "radial-gradient(circle, var(--qc-frame) 0%, var(--qc-frame) 20%, white 20%, white 35%, var(--qc-frame) 35%, var(--qc-frame) 55%, white 55%, white 70%, var(--qc-text) 70%, var(--qc-text) 100%)",
            boxShadow: "0 0 15px var(--qc-frame)",
            zIndex: 5,
          }}
        />
      )}

      {!gameActive && result && (
        <div className="aim-results-overlay">
          <div className="result-box">
            <h2>Results</h2>
            <p>Hits: {result.hits}</p>
            <p>Misses: {result.misses}</p>
            <p>Accuracy: {result.accuracy}%</p>
            <button
                  className="start-button"
                  onClick={() => {
                  setResult(null);
                  startGame();
                }}
              >
                Play Again
            </button>
          </div>  
        </div>
      )}

    </div>
  </div>
</div>

  );
}
