import AimGame from "./components/AimGame";
import { useNavigate } from "react-router-dom";
import "./AimTrainer.css";

export default function AimTrainerPage() { 
  const navigate = useNavigate(); 
  
   return ( 
    <div className="aimtrainer-page">

  <div className="aim-wrapper">
    <button 
      onClick={() => navigate("/practice")}
      className="back-button"
    >
      ← Back
    </button>

    <AimGame />
  </div>

</div>
  ); 
}