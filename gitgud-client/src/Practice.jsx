import { useNavigate } from "react-router-dom";

function Practice({ setPage }) {
  const navigate = useNavigate();
  return (
    <>
    <center>
      <h1>Practice</h1>

      <div style={{ display: "flex", gap: "16px" }}>
        <button
          className="practice"
          onClick={() => navigate("/practice/aim")}
        >
          Aim Trainer
        </button>

        <button className="practice" disabled>
          Reaction Trainer (Soon)
        </button>
      </div>

      <button
        style={{ marginTop: "20px" }}
        onClick={() => setPage("home")}
      >
        Back
      </button>
       </center>
    </>
  )
}

export default Practice