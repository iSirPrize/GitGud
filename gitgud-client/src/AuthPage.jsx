import { useState } from "react";
import { registerWithEmail, loginWithEmail, verifyEmail, auth } from "./auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useTheme } from "./context/ThemeContext";
import DarkModeToggle from "./components/DarkModeToggle";

function validatePassword(pw) {
  if (pw.length < 8)             return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(pw))         return "Must include an uppercase letter.";
  if (!/[0-9]/.test(pw))         return "Must include a number.";
  if (!/[^A-Za-z0-9]/.test(pw))  return "Must include a special character.";
  return null;
}

export default function AuthPage({ onIntent, unverifiedEmail }) {
  const [view, setView]         = useState("landing");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const { theme } = useTheme();
  const dark = theme === "dark";

  const reset = () => { setError(""); setEmail(""); setPassword(""); setConfirm(""); setResendSent(false); };

  async function handleLogin() {
    setError("");
    if (!email.trim()) return setError("Email is required.");
    onIntent("login");
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
    onIntent("register");
    setLoading(true);
    try {
      const cred = await registerWithEmail(email.trim(), password);
      await verifyEmail(cred.user);
      await auth.signOut();
      setView("verify");
    } catch (e) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    if (!email.trim() || !password) {
      return setError("Enter your email and password above to resend the verification link.");
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await verifyEmail(cred.user);
      await auth.signOut();
      setResendSent(true);
    } catch (e) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  }

  const accent     = dark ? "#ff6a00" : "#0066cc";
  const accentGlow = dark ? "rgba(255,106,0,0.25)" : "rgba(0,102,204,0.18)";
  const surface    = dark ? "#181818" : "#ffffff";
  const pageBg     = dark ? "#0d0d0d" : "#f0f4f8";
  const text       = dark ? "#f0f0f0" : "#111111";
  const inputBg    = dark ? "#222"    : "#f5f5f5";
  const inputBdr   = dark ? "#333"    : "#d0d0d0";
  const linkClr    = dark ? "#666"    : "#999";

  const s = {
    page: { minHeight: "100vh", background: pageBg, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "'Segoe UI','Helvetica Neue',sans-serif", padding: 16 },
    card: { background: surface, border: `2px solid ${accent}`, borderRadius: 16,
      boxShadow: `0 0 40px ${accentGlow}`, padding: "40px 36px", width: "100%", maxWidth: 380,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
    section:  { display: "flex", flexDirection: "column", gap: 10, width: "100%" },
    tagline:  { color: dark ? "#999" : "#666", fontSize: 14, margin: "0 0 16px", textAlign: "center" },
    heading:  { color: text, fontSize: 18, fontWeight: 700, margin: "0 0 12px", alignSelf: "flex-start" },
    input:    { background: inputBg, border: `1.5px solid ${inputBdr}`, borderRadius: 8, color: text,
      fontSize: 15, padding: "12px 14px", outline: "none", width: "100%", boxSizing: "border-box" },
    primary:  { background: accent, color: dark ? "#000" : "#fff", border: "none", borderRadius: 8,
      padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", letterSpacing: "0.03em" },
    ghost:    { background: "transparent", color: accent, border: `1.5px solid ${accent}`, borderRadius: 8,
      padding: "12px", fontSize: 15, fontWeight: 600, cursor: "pointer", width: "100%" },
    link:     { background: "none", border: "none", color: linkClr, fontSize: 13,
      cursor: "pointer", padding: "4px 0", textAlign: "center" },
    hint:     { color: dark ? "#555" : "#aaa", fontSize: 12, margin: "-4px 0 4px" },
    errorBox: { color: "#ef4444", fontSize: 13, margin: 0, background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "8px 12px" },
    success:  { color: "#22c55e", fontSize: 13, margin: 0, background: "rgba(34,197,94,0.08)",
      border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "8px 12px" },
    resendBtn:{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444",
      borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer", width: "100%" },
  };

  return (
    <div style={s.page}>
      {/* Same toggle as LandingPage — fixed top-right */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 200 }}>
        <DarkModeToggle />
      </div>

      <div style={s.card}>
        {/* Logo — same container dimensions as LandingPage */}
        <div style={{ width: 300, height: 240, maxWidth: "85vw", display: "flex",
          alignItems: "center", justifyContent: "center",
          filter: `drop-shadow(0 0 40px ${accentGlow})` }}>
          <img
            src={dark ? "/GitGud-dark.png" : "/GitGud-logo-transparent.png"}
            alt="GitGud"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", transition: "opacity 0.3s ease" }}
          />
        </div>

        {/* LANDING */}
        {view === "landing" && (
          <div style={s.section}>
            <p style={s.tagline}>To get better, one must first Git Gud.</p>
            <button style={s.primary} onClick={() => { reset(); setView("login"); }}>Log In</button>
            <button style={s.ghost}   onClick={() => { reset(); setView("register"); }}>Create Account</button>
          </div>
        )}

        {/* LOGIN */}
        {view === "login" && (
          <div style={s.section}>
            <p style={s.heading}>Welcome back</p>
            <input style={s.input} placeholder="Email" type="email"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            <input style={s.input} placeholder="Password" type="password"
              value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password" onKeyDown={e => e.key === "Enter" && handleLogin()} />

            {unverifiedEmail && !resendSent && (
              <div style={s.errorBox}>
                <p style={{ margin: "0 0 8px" }}>Your email isn't verified yet. Check your inbox (and spam).</p>
                <button style={s.resendBtn} onClick={handleResend} disabled={loading}>
                  {loading ? "Sending…" : "Resend Verification Email"}
                </button>
              </div>
            )}
            {unverifiedEmail && resendSent && (
              <p style={s.success}>Verification email sent! Check your inbox then log in again.</p>
            )}
            {error && <p style={s.errorBox}>{error}</p>}

            <button style={s.primary} onClick={handleLogin} disabled={loading}>
              {loading ? "Logging in…" : "Log In"}
            </button>
            <button style={s.link} onClick={() => { reset(); setView("register"); }}>No account? Register</button>
            <button style={s.link} onClick={() => { reset(); setView("landing"); }}>← Back</button>
          </div>
        )}

        {/* REGISTER */}
        {view === "register" && (
          <div style={s.section}>
            <p style={s.heading}>Create account</p>
            <input style={s.input} placeholder="Email" type="email"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            <input style={s.input} placeholder="Password" type="password"
              value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            <input style={s.input} placeholder="Confirm password" type="password"
              value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password"
              onKeyDown={e => e.key === "Enter" && handleRegister()} />
            <p style={s.hint}>8+ chars · uppercase · number · special character</p>
            {error && <p style={s.errorBox}>{error}</p>}
            <button style={s.primary} onClick={handleRegister} disabled={loading}>
              {loading ? "Creating…" : "Register"}
            </button>
            <button style={s.link} onClick={() => { reset(); setView("login"); }}>Have an account? Log in</button>
            <button style={s.link} onClick={() => { reset(); setView("landing"); }}>← Back</button>
          </div>
        )}

        {/* VERIFY */}
        {view === "verify" && (
          <div style={s.section}>
            <p style={s.heading}>Check your email</p>
            <p style={s.tagline}>
              A verification link was sent to <strong>{email}</strong>.
              Click it, then come back and log in.
            </p>
            <button style={s.primary} onClick={() => { reset(); setView("login"); }}>Go to Login</button>
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
