import { useState, useEffect } from "react";
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

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Wait a tick for AuthProvider to set the session from PASSWORD_RECOVERY event
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setValidSession(true);
      } else {
        setErrorMsg("Invalid or expired reset link. Please request a new one.");
      }
      setChecking(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
    } else {
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login"), 3000);
    }
  }

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
          <h2>Set New Password</h2>
          <p>Enter your new password below</p>
        </div>

        {errorMsg && <div className="login-alert">{errorMsg}</div>}

        {checking ? (
          <div className="login-sent">
            <p className="login-sent__text">Verifying reset link...</p>
          </div>
        ) : done ? (
          <div className="login-sent">
            <div className="login-sent__icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="login-sent__text">
              Password updated successfully! Redirecting you to sign in...
            </p>
          </div>
        ) : validSession ? (
          <form className="login-form" onSubmit={handleReset}>
            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="btn btn--primary login-submit"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        ) : (
          <div className="login-sent">
            <button
              type="button"
              className="btn btn--outline login-submit"
              onClick={() => navigate("/login")}
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}