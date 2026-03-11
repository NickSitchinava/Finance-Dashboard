import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logo from "../assets/F-Dash — Logo v2.png";
import "./LoginPage.css";

function Shape({
  width,
  height,
  rotate,
  top,
  left,
  right,
  bottom,
  color,
}: {
  width: number;
  height: number;
  rotate: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  color: string;
}) {
  return (
    <div
      className="login-shape"
      style={{
        width,
        height,
        transform: `rotate(${rotate}deg)`,
        top,
        left,
        right,
        bottom,
        background: `linear-gradient(to right, ${color}, transparent)`,
      }}
    />
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const navigate = useNavigate();

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setErrorMsg("Sign up successful! Please Confirm Via Email and Sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (error: any) {
      setErrorMsg(error.message || "Username or password is incorrect.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Background shapes */}
      <div className="login-shapes">
        <Shape width={600} height={140} rotate={12}  top="20%"   left="-5%"  color="rgba(232,123,58,0.18)" />
        <Shape width={500} height={120} rotate={-15} top="70%"   right="-2%" color="rgba(232,123,58,0.13)" />
        <Shape width={300} height={80}  rotate={-8}  bottom="10%" left="8%"  color="rgba(180,80,20,0.15)"  />
        <Shape width={200} height={60}  rotate={20}  top="12%"   right="18%" color="rgba(232,123,58,0.12)" />
        <Shape width={150} height={40}  rotate={-25} top="6%"    left="24%"  color="rgba(255,160,80,0.10)" />
      </div>

      {/* Ambient gradient */}
      <div className="login-ambient" />

      <div className="login-card card">
        <div className="login-card__header">
          <div className="login-card__logo">
            <img src={logo} alt="F-Dash Logo" />
          </div>
          <h2>Finance Dashboard</h2>
          <p>
            {mode === "signin"
              ? "Sign in to your account"
              : "Create a new account"}
          </p>
        </div>

        {errorMsg && (
          <div
            className={`login-alert ${
              mode === "signup" && !errorMsg.includes("error")
                ? "login-alert--success"
                : ""
            }`}
          >
            {errorMsg}
          </div>
        )}

        <form className="login-form" onSubmit={handleAuth}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nick@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {mode === "signup" && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn--primary login-submit"
            disabled={loading}
          >
            {loading ? "Processing..." : mode === "signin" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <div className="login-toggle">
          {mode === "signin" ? (
            <p>
              Don't have an account?{" "}
              <button type="button" className="text-btn" onClick={() => setMode("signup")}>
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button type="button" className="text-btn" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}