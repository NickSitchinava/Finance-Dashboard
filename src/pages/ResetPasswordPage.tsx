import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Check, LockKeyhole } from "lucide-react";
import { AuthShell } from "../components/auth/AuthShell";
import { PasswordField } from "./LoginPage";
import { PasswordStrength } from "../components/auth/PasswordStrength";
import { supabase } from "../lib/supabase";

type State = "checking" | "ready" | "done" | "error";

export default function ResetPasswordPage() {
  const [state, setState] = useState<State>(() => location.search.includes("error=") || location.hash.includes("error=") ? "error" : "checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => location.search.includes("error=") || location.hash.includes("error=") ? "This reset link is invalid or has expired. Request a new one." : "");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const hash = new URLSearchParams(location.hash.slice(1));
    const query = new URLSearchParams(location.search);
    const failed = hash.has("error") || query.has("error");
    if (failed) {
      history.replaceState(null, "", "/reset-password");
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "PASSWORD_RECOVERY") setState("ready");
    });
    async function validateLink() {
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (hash.get("type") === "recovery" && accessToken && refreshToken) {
        const { error: authError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (!active) return;
        history.replaceState(null, "", "/reset-password");
        if (!authError) { setState("ready"); return; }
      } else if (query.has("code")) {
        const { error: authError } = await supabase.auth.exchangeCodeForSession(query.get("code")!);
        if (!active) return;
        history.replaceState(null, "", "/reset-password");
        if (!authError) { setState("ready"); return; }
      }
      if (active) { setError("This reset link is invalid or has expired. Request a new one."); setState("error"); }
    }
    void validateLink();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setError("");
    if (password.length < 6) { setError("Use at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (authError) { setError(/weak password|password should/i.test(authError.message) ? "Choose a longer password and try again." : "We couldn't update your password. Request a new link and try again."); return; }
    setState("done");
    await supabase.auth.signOut();
  }

  return <AuthShell>
    <header className="auth-header"><h1>{state === "ready" ? "Set a new password." : state === "done" ? "Password updated." : state === "error" ? "Link expired." : "Checking your link."}</h1>
      <p>{state === "ready" ? "Choose a password for your F-Dash account." : state === "done" ? "You can now sign in with your new password." : state === "error" ? "Request a new link to continue." : "This will only take a moment."}</p></header>
    {error && <p className="auth-alert" role="alert">{error}</p>}
    {state === "checking" && <div className="auth-message" role="status"><span className="auth-spinner auth-spinner--dark" />Verifying your secure link…</div>}
    {state === "ready" && <form className="auth-form" onSubmit={submit}>
      <PasswordField id="auth-new-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
      <PasswordStrength password={password} className="auth-strength" />
      <PasswordField id="auth-confirm-password" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <button className="auth-primary" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
    </form>}
    {(state === "done" || state === "error") && <div className="auth-message">
      <div className="auth-message-icon">{state === "done" ? <Check size={25} /> : <LockKeyhole size={25} />}</div>
      <button type="button" className="auth-primary" onClick={() => { sessionStorage.setItem("fd-auth-internal", "1"); navigate(state === "done" ? "/login" : "/login?mode=forgot"); }}>{state === "done" ? "Back to sign in" : "Request a new link"}</button>
    </div>}
  </AuthShell>;
}
