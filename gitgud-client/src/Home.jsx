import { Navigate } from "react-router-dom";

function Home({ user }) {
  if (user === undefined) return <div>Loading</div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div style={{ padding: "2rem", color: "#f0f0f0" }}>
      <h1>Welcome, {user.displayName || "Player"}!</h1>
      <p>Here's how to use the site:</p>
      <ul>
        <li><strong>Practice</strong> – sharpen your skills</li>
        <li><strong>Quiz</strong> – test your knowledge by category</li>
        <li><strong>Leaderboard</strong> – see how you rank</li>
        <li><strong>Profile</strong> – track your progress</li>
      </ul>
    </div>
  );
}

export default Home;