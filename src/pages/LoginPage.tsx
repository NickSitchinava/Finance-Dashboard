import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, ArrowRight, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { AuthShell } from "../components/auth/AuthShell";
import { PasswordStrength } from "../components/auth/PasswordStrength";
import { LabelInput } from "../components/ui/LabelInput";
import "../components/ui/LabelInput.css";
import { ensureProfile } from "../components/auth/authProfiles";

type Mode = "signin" | "signup" | "forgot" | "forgot-sent" | "verify-pending" | "verify-error" | "verify-success";

function authMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect. Please try again.";
  if (/email not confirmed/i.test(message)) return "Please verify your email before signing in.";
  if (/rate limit|too many requests/i.test(message)) return "Too many attempts. Please wait a moment and try again.";
  if (/already registered|already exists/i.test(message)) return "An account may already exist for this email. Try signing in or resetting your password.";
  if (/weak password|password should|at least 6 characters/i.test(message)) return "Choose a longer password and try again.";
  if (/network|fetch|offline/i.test(message)) return "Connection lost. Check your internet connection and try again.";
  return "We couldn't complete that request. Please try again in a moment.";
}

export function PasswordField({ id, label, value, onChange, autoComplete, error, shakeToken }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  autoComplete: string; error?: string; shakeToken?: number;
}) {
  return <LabelInput id={id} field={label} type="password" corner={20} value={value}
    onChange={onChange} autoComplete={autoComplete} error={error} shakeToken={shakeToken} required minLength={6} />;
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>(() => {
    if (location.search.includes("error=") || location.hash.includes("error=")) return "verify-error";
    const requested = new URLSearchParams(location.search).get("mode");
    return requested === "signup" || requested === "forgot" ? requested : "signin";
  });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [errorField, setErrorField] = useState("");
  const [shakeToken, setShakeToken] = useState(0);
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();
  const verificationArrival = useRef(/type=(signup|email)/.test(location.hash) || new URLSearchParams(location.search).has("token_hash"));
  const failField = (field: string, message: string) => {
    setErrorField(field); setFieldError(message); setShakeToken(value => value + 1);
  };
  const clearField = (field: string) => {
    if (errorField === field) { setErrorField(""); setFieldError(""); }
  };
  const fieldMessage = (field: string) => errorField === field ? fieldError : undefined;
  const fieldShake = (field: string) => errorField === field ? shakeToken : 0;
  const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  useEffect(() => {
    const onBack = () => {
      const requested = new URLSearchParams(location.search).get("mode");
      setMode(requested === "signup" || requested === "forgot" ? requested : "signin");
      setError(""); setFieldError(""); setErrorField(""); setNotice("");
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.slice(1));
    const linkError = params.get("error_description") || hash.get("error_description") || params.get("error");
    if (linkError) {
      setMode("verify-error");
      setError("This verification link is invalid or has expired. Request a new one below.");
      history.replaceState(null, "", "/login");
      return;
    }
    if (hash.get("type") === "recovery") return;
    let active = true;
    let redirectTimer: number | undefined;
    async function restore() {
      const tokenHash = params.get("token_hash");
      if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
        if (!active) return;
        history.replaceState(null, "", "/login");
        if (verifyError) {
          setMode("verify-error");
          setError("This verification link is invalid or has expired. Request a new one below.");
          return;
        }
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session?.user?.email_confirmed_at) return;
      try { await ensureProfile(session.user.id, String(session.user.user_metadata?.full_name ?? "")); }
      catch { if (active) setError("Your account is signed in, but profile setup could not finish. Refresh to try again."); return; }
      if (!active) return;
      if (verificationArrival.current) {
        setMode("verify-success");
        redirectTimer = window.setTimeout(() => navigate("/", { replace: true }), 1200);
      } else navigate("/", { replace: true });
    }
    void restore();
    return () => { active = false; window.clearTimeout(redirectTimer); };
  }, [navigate]);

  function switchMode(next: Mode) {
    setMode(next); setError(""); setFieldError(""); setErrorField(""); setNotice("");
    setPassword(""); setConfirmPassword("");
    navigate(next === "signup" || next === "forgot" ? `/login?mode=${next}` : "/login");
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(""); setFieldError(""); setErrorField(""); setNotice("");
    if (mode === "signup") {
      if (!fullName.trim()) { failField("name", "Enter your name."); return; }
    }
    if (!validEmail(email)) { failField("email", "Enter a valid email address."); return; }
    if (mode === "signup" && password.length < 6) { failField("password", "Use at least 6 characters."); return; }
    if (mode === "signin" && password.length < 6) { failField("password", password ? "Use at least 6 characters." : "Enter your password."); return; }
    if (mode === "signup" && password !== confirmPassword) { failField("confirm", "Passwords do not match."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${location.origin}/login` },
        });
        if (authError) throw authError;
        if (data.session?.user.email_confirmed_at) {
          await ensureProfile(data.session.user.id, fullName);
          navigate("/", { replace: true });
        } else setMode("verify-pending");
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        if (!data.user?.email_confirmed_at) { setMode("verify-pending"); return; }
        await ensureProfile(data.user.id, String(data.user.user_metadata?.full_name ?? ""));
        navigate("/", { replace: true });
      }
    } catch (caught) {
      const message = authMessage(caught);
      const raw = caught instanceof Error ? caught.message : "";
      if (/invalid login credentials/i.test(raw)) failField("password", message);
      else if (/already registered|already exists|invalid email/i.test(raw)) failField("email", message);
      else if (/weak password|password should|at least 6 characters/i.test(raw)) failField("password", message);
      else setError(message);
    }
    finally { setBusy(false); }
  }

  async function sendReset(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (!validEmail(email)) { failField("email", "Enter a valid email address."); return; }
    setBusy(true); setError("");
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/reset-password`,
    });
    setBusy(false);
    if (authError) setError(authMessage(authError)); else setMode("forgot-sent");
  }

  async function resend() {
    if (busy) return;
    if (!validEmail(email)) { failField("email", "Enter a valid email address."); return; }
    setBusy(true); setError(""); setNotice("");
    const { error: authError } = await supabase.auth.resend({ type: "signup", email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/login` } });
    setBusy(false);
    if (authError) setError(authMessage(authError)); else setNotice("A new verification link is on its way. Check your inbox.");
  }

  const title = {
    signin: ["Welcome back.", "Sign in to continue to F-Dash."],
    signup: ["Create your account.", "Your F-Dash workspace starts here."],
    forgot: ["Reset your password.", "We'll send a secure link to your email."],
    "forgot-sent": ["Check your inbox.", "If an account exists for this address, a reset link is on its way."],
    "verify-pending": ["Verify your email.", "Open the link we sent to finish setting up your account."],
    "verify-error": ["Link expired.", "Request a fresh verification link to continue."],
    "verify-success": ["Email verified.", "Your F-Dash workspace is ready."],
  }[mode];

  return <AuthShell intro={!verificationArrival.current && mode !== "verify-error"} compact={mode === "signup"}>
    <header className="auth-header"><h1>{title[0]}</h1><p>{title[1]}</p></header>
    {error && <p className="auth-alert" role="alert">{error}</p>}
    {notice && <p className="auth-alert auth-alert--success" role="status">{notice}</p>}
    {(mode === "signin" || mode === "signup") && <form className="auth-form" onSubmit={submitAuth} noValidate>
      {mode === "signup" && <LabelInput id="auth-name" field="Full name" type="text" corner={20}
        value={fullName} onChange={value => { setFullName(value); clearField("name"); }} autoComplete="name" required
        error={fieldMessage("name")} shakeToken={fieldShake("name")} />}
      <LabelInput id="auth-email" field="Email" type="email" corner={20}
        value={email} onChange={value => { setEmail(value); clearField("email"); }} autoComplete="email" inputMode="email" required
        error={fieldMessage("email")} shakeToken={fieldShake("email")} />
      <PasswordField id="auth-password" label="Password" value={password} onChange={value => { setPassword(value); clearField("password"); }}
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        error={fieldMessage("password")} shakeToken={fieldShake("password")} />
      {mode === "signup" && <><PasswordStrength password={password} className="auth-strength" />
        <PasswordField id="auth-confirm" label="Confirm password" value={confirmPassword}
          onChange={value => { setConfirmPassword(value); clearField("confirm"); }} autoComplete="new-password"
          error={fieldMessage("confirm")} shakeToken={fieldShake("confirm")} /></>}
      {mode === "signin" && <button type="button" className="auth-text-link auth-forgot" onClick={() => switchMode("forgot")}>Forgot password?</button>}
      <button className="auth-primary" type="submit" disabled={busy}>
        {busy ? <><span className="auth-spinner" />{mode === "signin" ? "Signing in…" : "Creating account…"}</> : <>{mode === "signin" ? "Sign in" : "Create account"}<ArrowRight size={18} /></>}
      </button>
    </form>}
    {mode === "forgot" && <form className="auth-form" onSubmit={sendReset} noValidate>
      <LabelInput id="auth-reset-email" field="Email" type="email" corner={20}
        value={email} onChange={value => { setEmail(value); clearField("email"); }} autoComplete="email" inputMode="email" required
        error={fieldMessage("email")} shakeToken={fieldShake("email")} />
      <button className="auth-primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
    </form>}
    {(mode === "forgot-sent" || mode === "verify-pending" || mode === "verify-error" || mode === "verify-success") && <div className="auth-message">
      <div className="auth-message-icon">{mode === "verify-success" ? <Check size={25} strokeWidth={1.7} /> : <Mail size={25} strokeWidth={1.6} />}</div>
      {email && <p className="auth-message-email">{email}</p>}
      {mode === "verify-error" && !email && <div className="auth-message-field"><LabelInput id="auth-resend-email" field="Email" type="email" corner={20}
        value={email} onChange={value => { setEmail(value); clearField("email"); }} autoComplete="email" inputMode="email" required
        error={fieldMessage("email")} shakeToken={fieldShake("email")} /></div>}
      {mode !== "forgot-sent" && mode !== "verify-success" && <button type="button" className="auth-primary" onClick={resend} disabled={busy}>{busy ? "Sending…" : "Resend verification email"}</button>}
    </div>}
    {mode !== "verify-success" && <footer className="auth-footer">
      {mode === "signin" ? <>New to F-Dash? <button className="auth-text-link" type="button" onClick={() => switchMode("signup")}>Create an account</button></> :
        mode === "signup" ? <>Already have an account? <button className="auth-text-link" type="button" onClick={() => switchMode("signin")}>Sign in</button></> :
        <button className="auth-text-link" type="button" onClick={() => switchMode("signin")}>Back to sign in</button>}
    </footer>}
  </AuthShell>;
}
