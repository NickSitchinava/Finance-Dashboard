import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LiquidLogoReveal } from "./LiquidLogoReveal";
import { getAuthMark } from "./authVisuals";
import "../../pages/LoginPage.css";

export function AuthShell({ children, intro = false, compact = false }: { children: ReactNode; intro?: boolean; compact?: boolean }) {
  const [mark, setMark] = useState("");
  const [phase, setPhase] = useState<"reveal" | "fade" | "done">(() =>
    intro && !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    sessionStorage.getItem("fd-auth-internal") !== "1" ? "reveal" : "done");

  useEffect(() => {
    sessionStorage.removeItem("fd-auth-internal");
    let active = true;
    void getAuthMark().then((url) => { if (active) setMark(url); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (phase !== "reveal" || !mark) return;
    const fade = window.setTimeout(() => setPhase("fade"), 2150);
    return () => window.clearTimeout(fade);
  }, [phase, mark]);

  useEffect(() => {
    if (phase !== "fade") return;
    const done = window.setTimeout(() => setPhase("done"), 560);
    return () => window.clearTimeout(done);
  }, [phase]);

  return <main className={`auth-page auth-page--${phase}${compact ? " auth-page--compact" : ""}`}>
    <div className="auth-shapes" aria-hidden="true">
      <i className="auth-shape auth-shape--one" /><i className="auth-shape auth-shape--two" />
      <i className="auth-shape auth-shape--three" /><i className="auth-shape auth-shape--four" />
      <i className="auth-shape auth-shape--five" />
    </div>
    <section className="auth-card" aria-label="F-Dash authentication" inert={phase === "reveal"}>
      <div className="auth-logo-slot">
        {mark && <img className="auth-logo" src={mark} alt="F-Dash" />}
      </div>
      {children}
    </section>
    {phase !== "done" && mark && <div className="auth-intro-mark" aria-hidden="true">
      <LiquidLogoReveal logo={mark} label="F-Dash" background="#F7F7FF" logoColor="#27187E"
        originalColors={false} tileSize={256} logoScale={0.86} finalScale={0.95}
        speed={2.1} loop={false} className="auth-intro-canvas" />
    </div>}
  </main>;
}
