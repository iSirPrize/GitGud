import AimGame from "./components/AimGame";
import { useNavigate } from "react-router-dom";

export default function AimTrainerPage() {
  const navigate = useNavigate();

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      
      {/* Back Button */}
      <button
        onClick={() => navigate("/practice")}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          zIndex: 10,
        }}
      >
        ← Back
      </button>

      {/* Game */}
      <AimGame />
    </div>
  );
}