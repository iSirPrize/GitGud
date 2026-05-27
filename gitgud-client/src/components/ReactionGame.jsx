import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import "./ReactionGame.css";
import background from "../assets/reaction/dust2-doors-background.png";
import scopeOverlay from "../assets/reaction/scope-overlay.png";
import target from "../assets/reaction/terrorist-target.png";
import { db, auth } from "../firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { useDailies } from "../useDailies";


const TOTAL_ROUNDS = 8;

export default function ReactionGame() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  // DAILIES: hook called directly using firebase auth uid
  const { recordProgress } = useDailies(auth.currentUser?.uid);

  const [gameState, setGameState] = useState("idle");
  // idle | waiting | visible | result | complete | too-early

  const [round, setRound] = useState(1);
  const [reactionTimes, setReactionTimes] = useState([]);
  const [currentReaction, setCurrentReaction] = useState(null);
  const [message, setMessage] = useState("Press Start to Begin");
  const [targetVisible, setTargetVisible] = useState(false);

  const startTimeRef = useRef(null);
  const spawnTimeoutRef = useRef(null);
  const enemyShootTimeoutRef = useRef(null);
  const nextRoundTimeoutRef = useRef(null);
  const gameEndedRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
  return () => {
    clearAllTimeouts();
  };
}, []);

  function clearAllTimeouts() {
  clearTimeout(spawnTimeoutRef.current);
  clearTimeout(enemyShootTimeoutRef.current);
  clearTimeout(nextRoundTimeoutRef.current);
}

  // Start a new session
  function startGame() {
    clearAllTimeouts();
    gameEndedRef.current = false;
    setReactionTimes([]);
    setRound(1);
    setCurrentReaction(null);
    setGameState("idle");
    setMessage("Press Start to Begin");
    setTargetVisible(false);
  }

//for leaderboard, will add to firestore collection after each session
async function saveReactionResult(avg, best, rounds) {
  try {
    const user = auth.currentUser;
    let username = user?.displayName || "Anonymous";
    let photoURL = user?.photoURL || "";
    if (user) {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        username = data.username || data.displayName || username;
        photoURL = data.photoURL || photoURL;
      }
    }
    await addDoc(collection(db, "reactionResults"), {
      userId: user ? user.uid : "guest",
      username,
      photoURL,
      average: avg,
      best,
      rounds,
      createdAt: serverTimestamp(),
    });
    console.log("Reaction results saved!");
  } catch (err) {
    console.error("Error saving reaction result:", err);
  }
}

  // Start a single round
  function startRound() {
  gameEndedRef.current = false;
  clearAllTimeouts();
  setGameState("waiting");
  setMessage("Get Ready...");
  setCurrentReaction(null);
  setTargetVisible(false);

  const delay = Math.random() * 3000 + 2000;

  spawnTimeoutRef.current = setTimeout(() => {
    setTargetVisible(true);
    setGameState("visible");
    setMessage("SHOOT!");
    startTimeRef.current = performance.now();

    // Enemy shoots if player is too slow
    enemyShootTimeoutRef.current = setTimeout(() => {
      setTargetVisible(false);
      setGameState("too-early");
      setMessage("Too Slow! You were eliminated.");

      nextRoundTimeoutRef.current = setTimeout(() => {
        startRound();
      }, 1500);
    }, 800);
  }, delay);
}


const [targetLoaded, setTargetLoaded] = useState(false);

useEffect(() => {
  const img = new Image();
  img.src = target;
  img.onload = () => setTargetLoaded(true);
  img.onerror = () => setTargetLoaded(true); // fail safe
  return () => {
    // no cleanup needed for Image, but keep consistent
  };
}, []);


  // Handle clicking on the game area
  function handleShot() {
    // Too early
    if (gameState === "waiting") {
      clearAllTimeouts();
      setGameState("too-early");
      setMessage("Too Early! Wait for the target.");
      setTargetVisible(false);

      nextRoundTimeoutRef.current = setTimeout(() => {
      startRound();
      }, 1500);

      return;
    }

    // Valid shot
    if (gameState === "visible") {
      clearAllTimeouts();
      const reaction = Math.round(
        performance.now() - startTimeRef.current
      );


      const updatedTimes = [...reactionTimes, reaction];

      setReactionTimes(updatedTimes);
      setCurrentReaction(reaction);
      setTargetVisible(false);

      // Session complete
      if (updatedTimes.length >= TOTAL_ROUNDS) {
        if (gameEndedRef.current) return;
        gameEndedRef.current = true;
        setGameState("complete");
        setMessage("Session Complete!")
        const finalAvg = Math.round(
  updatedTimes.reduce((sum, t) => sum + t, 0) / updatedTimes.length
);
const finalBest = Math.min(...updatedTimes);
saveReactionResult(finalAvg, finalBest, updatedTimes.length);
        // DAILIES: full session completed — report to daily quests
        recordProgress("reaction", { session: true });
      } else {
        // Show result briefly before next round
        setGameState("result");
        setMessage(`${reaction} ms`);

        nextRoundTimeoutRef.current = setTimeout(() => {
        setRound(updatedTimes.length + 1);
        startRound();
        }, 1500);
      }
    }
  }

  // Start button logic
  function handleStartButton() {
  clearAllTimeouts();
  gameEndedRef.current = false;
  startGame();   // resets everything
  startRound();  // starts the first round
}


  // Stats calculations
  const averageReaction =
    reactionTimes.length > 0
      ? Math.round(
          reactionTimes.reduce((sum, time) => sum + time, 0) /
            reactionTimes.length
        )
      : 0;

  const bestReaction =
    reactionTimes.length > 0
      ? Math.min(...reactionTimes)
      : 0;

  // Rank system

  function getReactionRank(avg) {
  if (avg >= 500) {
    return {
      rank: "Turtle 🐢",
      comment: "Did you fall asleep at the keyboard? Try to stay alert!"
    };
  } else if (avg >= 400) {
    return {
      rank: "Sloth 🦥",
      comment: "My Nana has faster reflexes!"
    };
  } else if (avg >= 300) {
    return {
      rank: "Rabbit 🐇",
      comment: "Solid reflexes."
    };
  } else if (avg >= 220) {
    return {
      rank: "Cheetah 🐆",
      comment: "Very sharp reflexes."
    };
  } else if (avg >= 170) {
    return {
      rank: "Falcon 🦅",
      comment: "Competitive-level reaction speed."
    };
  } else {
    return {
      rank: "Lightning Hawk ⚡",
      comment: "Absolutely cracked."
    };
  }
}

  const finalRank =
    gameState === "complete"
      ? getReactionRank(averageReaction)
      : null;

useEffect(() => {
  function handleClickOutside(e) {
    const gameEl = document.querySelector(".reaction-game");

    if (!gameEl.contains(e.target)) {
  // Ignore pause behavior before the first round starts
  if (round === 1 && gameState === "idle") {
    return;
  }

  setIsFocused(false);
  setTargetVisible(false);
  clearAllTimeouts();

  if (gameState !== "idle" && gameState !== "complete") {
    setMessage("Paused — click to resume");
  }
}

  }

  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, [gameState]);

  return (
    <div className={`reaction-page ${theme}`}>

  {/* Header */}
  <div className="reaction-header">

    <h1>Reaction Trainer</h1>
    <p>Wait for the enemy to peek and click as fast as you can.</p>
  </div>
  {/* Game Area */}
  <div className="game-wrapper">

    {/* Stats Overlay */}
    <div className="stats-overlay">
  <div className="stat-card">
    <span className="stat-label">Round</span>
    <span className="stat-value">
      {Math.min(round, TOTAL_ROUNDS)}/{TOTAL_ROUNDS}
    </span>
  </div>

  <div className="stat-card">
    <span className="stat-label">Average</span>
    <span className="stat-value">
      {reactionTimes.length > 0 ? `${averageReaction} ms` : "--"}
    </span>
  </div>

  <div className="stat-card">
    <span className="stat-label">Best</span>
    <span className="stat-value">
      {reactionTimes.length > 0 ? `${bestReaction} ms` : "--"}
    </span>
  </div>

  <div className="stat-card">
    <span className="stat-label">Last</span>
    <span className="stat-value">
      {currentReaction ? `${currentReaction} ms` : "--"}
    </span>
  </div>

  {/* START BUTTON BELOW STATS */}
  {(gameState === "idle" || gameState === "complete") && (
    <div className="controls side-controls">
      <button
        className="start-button"
        onClick={handleStartButton}
      >
        {gameState === "complete" ? "Play Again" : "Start"}
      </button>
    </div>
  )}
</div>


    {/* Reaction Game */}
    <div
  className="reaction-game"
  onClick={(e) => {
    e.stopPropagation();

    if (!isFocused) {
      setIsFocused(true);
      setMessage("Get Ready...");
      // If gameState was mid-round, we must restart the round
      if (gameState !== "idle" && gameState !== "complete") {
        startRound();
      }
      return;
    }
    handleShot();
    }}>
      <img src={background} alt="Dust II Doors" className="background-image" />

      {targetVisible && (
        <img src={target} alt="Enemy Target" className="enemy-target" />
      )}

      {!isFocused && round > 1 && gameState !== "complete" && (
  <div className="reaction-pause-overlay">
    <span>Click on Screen to Resume</span>
  </div>
)}

      <img src={scopeOverlay} alt="Sniper Scope" className="scope-image" />

      <div className="game-message">{message}</div>

      {gameState === "complete" && finalRank && (
        <div className="reaction-results-overlay">
          <div className="result-box">
            <h2>Session Complete!</h2>

            <div className="results-grid">
              <div><strong>Average:</strong> {averageReaction} ms</div>
              <div><strong>Best:</strong> {bestReaction} ms</div>
              <div><strong>Shots:</strong> {reactionTimes.length}</div>
            </div>

            <div className="rank-display">
              <h3>{finalRank.rank}</h3>
              <p>{finalRank.comment}</p>
            </div>

            <button
              className="start-button"
              onClick={(e) => {
                e.stopPropagation();
                handleStartButton();
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