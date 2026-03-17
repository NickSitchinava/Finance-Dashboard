import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logo from "../assets/F-Dash — Logo v2.png";
import "./LoginPage.css";

function Shape({
  width, height, rotate, top, left, right, bottom, color,
}: {
  width: number; height: number; rotate: number;
  top?: string; left?: string; right?: string; bottom?: string; color: string;
}) {
  return (
    <div
      className="login-shape"
      style={{
        width, height,
        transform: `rotate(${rotate}deg)`,
        top, left, right, bottom,
        background: `linear-gradient(to right, ${color}, transparent)`,
      }}
    />
  );
}

type Mode = "signin" | "signup" | "forgot" | "forgot-sent";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const navigate = useNavigate();

  function switchMode(next: Mode) {
    setMode(next);
    setErrorMsg("");
    setSuccessMsg("");
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (mode === "signup") {
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccessMsg("Sign up successful! Please confirm via email then sign in.");
        switchMode("signin");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (error: any) {
      setErrorMsg(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      switchMode("forgot-sent");
    } catch (error: any) {
      setErrorMsg(error.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<Mode, { heading: string; sub: string }> = {
    signin:       { heading: "Finance Dashboard", sub: "Sign in to your account" },
    signup:       { heading: "Finance Dashboard", sub: "Create a new account" },
    forgot:       { heading: "Reset Password",    sub: "Enter your email to receive a reset link" },
    "forgot-sent":{ heading: "Check Your Email",  sub: `A reset link was sent to ${email}` },
  };

  return (
    <div className="login-page">
      <div className="login-shapes">
        <Shape width={600} height={140} rotate={12}  top="20%"    left="-5%"  color="rgba(232,123,58,0.18)" />
        <Shape width={500} height={120} rotate={-15} top="70%"    right="-2%" color="rgba(232,123,58,0.13)" />
        <Shape width={300} height={80}  rotate={-8}  bottom="10%" left="8%"   color="rgba(180,80,20,0.15)"  />
        <Shape width={200} height={60}  rotate={20}  top="12%"    right="18%" color="rgba(232,123,58,0.12)" />
        <Shape width={150} height={40}  rotate={-25} top="6%"     left="24%"  color="rgba(255,160,80,0.10)" />
      </div>

      <div className="login-ambient" />

      <div className="login-card card">
        <div className="login-card__header">
          <div className="login-card__logo">
            <img src={logo} alt="F-Dash Logo" />
          </div>
          <h2>{titles[mode].heading}</h2>
          <p>{titles[mode].sub}</p>
        </div>

        {/* Alerts */}
        {errorMsg && <div className="login-alert">{errorMsg}</div>}
        {successMsg && <div className="login-alert login-alert--success">{successMsg}</div>}

        {/* Sign In / Sign Up form */}
        {(mode === "signin" || mode === "signup") && (
          <form className="login-form" onSubmit={handleAuth}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email" type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="nick@example.com"
              />
            </div>

            <div className="form-group">
              <div className="login-password-label">
                <label htmlFor="password">Password</label>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-btn text-btn--small"
                    onClick={() => switchMode("forgot")}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="password" type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {mode === "signup" && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword" type="password" required
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            )}

            <button type="submit" className="btn btn--primary login-submit" disabled={loading}>
              {loading ? "Processing..." : mode === "signin" ? "Sign In" : "Sign Up"}
            </button>
          </form>
        )}

        {/* Forgot password form */}
        {mode === "forgot" && (
          <form className="login-form" onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email" type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="nick@example.com"
              />
            </div>
            <button type="submit" className="btn btn--primary login-submit" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <button
              type="button"
              className="btn btn--outline login-submit"
              onClick={() => switchMode("signin")}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {/* Email sent confirmation */}
        {mode === "forgot-sent" && (
          <div className="login-sent">
            <div className="login-sent__icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <p className="login-sent__text">
              Check your inbox and click the link to reset your password. You can close this page.
            </p>
            <button
              type="button"
              className="btn btn--outline login-submit"
              onClick={() => switchMode("signin")}
            >
              Back to Sign In
            </button>
          </div>
        )}

        {/* Toggle signin/signup */}
        {(mode === "signin" || mode === "signup") && (
          <div className="login-toggle">
            {mode === "signin" ? (
              <p>
                Don't have an account?{" "}
                <button type="button" className="text-btn" onClick={() => switchMode("signup")}>
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button type="button" className="text-btn" onClick={() => switchMode("signin")}>
                  Sign in
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}