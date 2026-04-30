import { useState } from "react";
import { registerWithEmail, loginWithEmail } from "./auth";

function validatePassword(pw) {
  if (pw.length < 8)             return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(pw))         return "Must include an uppercase letter.";
  if (!/[0-9]/.test(pw))         return "Must include a number.";
  if (!/[^A-Za-z0-9]/.test(pw))  return "Must include a special character.";
  return null;
}

export default function AuthPage({ onIntent })  {
  const [view, setView]         = useState("landing"); // "landing" | "login" | "register"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const reset = () => { setError(""); setEmail(""); setPassword(""); setConfirm(""); };

  async function handleLogin() {
    setError("");
    if (!email.trim()) return setError("Email is required.");
    onIntent('login')
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (e) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError("");
    if (!email.trim()) return setError("Email is required.");
    if (!email.includes("@")) return setError("Please enter a valid email.");
    const pwErr = validatePassword(password);
    if (pwErr) return setError(pwErr);
    if (password !== confirm) return setError("Passwords do not match.");
    onIntent('register')
    setLoading(true);
    try {
      await registerWithEmail(email.trim(), password);
    } catch (e) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <div style={styles.logo}>
          <span style={styles.logoAccent}>git</span>gud
        </div>

        {/* LANDING */}
        {view === "landing" && (
          <div style={styles.section}>
            <p style={styles.tagline}>To get better, one must first Git Gud.</p>
            <button style={styles.primary} onClick={() => { reset(); setView("login"); }}>
              Log In
            </button>
            <button style={styles.ghost} onClick={() => { reset(); setView("register"); }}>
              Create Account
            </button>
          </div>
        )}

        {/* LOGIN */}
        {view === "login" && (
          <div style={styles.section}>
            <p style={styles.heading}>Welcome back</p>
            <input style={styles.input} placeholder="Email" type="email"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            <input style={styles.input} placeholder="Password" type="password"
              value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.primary} onClick={handleLogin} disabled={loading}>
              {loading ? "Logging in…" : "Log In"}
            </button>
            <button style={styles.link} onClick={() => { reset(); setView("register"); }}>
              No account? Register
            </button>
            <button style={styles.link} onClick={() => { reset(); setView("landing"); }}>
              ← Back
            </button>
          </div>
        )}

        {/* REGISTER */}
        {view === "register" && (
          <div style={styles.section}>
            <p style={styles.heading}>Create account</p>
            <input style={styles.input} placeholder="Email" type="email"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            <input style={styles.input} placeholder="Password" type="password"
              value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            <input style={styles.input} placeholder="Confirm password" type="password"
              value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password"
              onKeyDown={e => e.key === "Enter" && handleRegister()} />
            <p style={styles.hint}>8+ chars · uppercase · number · special character</p>
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.primary} onClick={handleRegister} disabled={loading}>
              {loading ? "Creating…" : "Register"}
            </button>
            <button style={styles.link} onClick={() => { reset(); setView("login"); }}>
              Have an account? Log in
            </button>
            <button style={styles.link} onClick={() => { reset(); setView("landing"); }}>
              ← Back
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function friendlyError(code) {
  switch (code) {
    case "auth/email-already-in-use":  return "That email is already registered.";
    case "auth/invalid-email":         return "Invalid email address.";
    case "auth/user-not-found":        return "No account found with that email.";
    case "auth/wrong-password":        return "Incorrect password.";
    case "auth/invalid-credential":    return "Incorrect email or password.";
    case "auth/too-many-requests":     return "Too many attempts. Try again later.";
    default: return "Something went wrong. Please try again.";
  }
}

const ORANGE = "#ff6a00";
const styles = {
  page: { minHeight: "100vh", background: "#0d0d0d", display: "flex",
    alignItems: "center", justifyContent: "center",
    fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif", padding: 16 },
  card: { background: "#181818", border: `2px solid ${ORANGE}`, borderRadius: 16,
    boxShadow: `0 0 40px rgba(255,106,0,0.25)`, padding: "40px 36px",
    width: "100%", maxWidth: 380, display: "flex", flexDirection: "column",
    alignItems: "center", gap: 8 },
  logo: { fontSize: 36, fontWeight: 800, color: "#f0f0f0",
    letterSpacing: "-0.04em", marginBottom: 8 },
  logoAccent: { color: ORANGE },
  tagline: { color: "#999", fontSize: 14, margin: "0 0 16px", textAlign: "center" },
  heading: { color: "#f0f0f0", fontSize: 18, fontWeight: 700,
    margin: "0 0 12px", alignSelf: "flex-start" },
  section: { display: "flex", flexDirection: "column", gap: 10, width: "100%" },
  input: { background: "#222", border: "1.5px solid #333", borderRadius: 8,
    color: "#f0f0f0", fontSize: 15, padding: "12px 14px", outline: "none",
    width: "100%", boxSizing: "border-box" },
  primary: { background: ORANGE, color: "#000", border: "none", borderRadius: 8,
    padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer",
    width: "100%", letterSpacing: "0.03em" },
  ghost: { background: "transparent", color: ORANGE, border: `1.5px solid ${ORANGE}`,
    borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 600,
    cursor: "pointer", width: "100%" },
  link: { background: "none", border: "none", color: "#666", fontSize: 13,
    cursor: "pointer", padding: "4px 0", textAlign: "center" },
  hint: { color: "#555", fontSize: 12, margin: "-4px 0 4px" },
  error: { color: "#ef4444", fontSize: 13, margin: 0,
    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 6, padding: "8px 12px" },
};