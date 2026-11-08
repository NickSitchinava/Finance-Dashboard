import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import "./SwipeToast.css";

export default function SwipeToast({
  kind,
  message,
  onClose,
  onRetry,
  retryDisabled,
}: {
  kind: "error" | "success";
  message: string;
  onClose: () => void;
  onRetry?: () => void;
  retryDisabled?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const remaining = useRef(5000);

  useEffect(() => {
    if (kind === "error" || paused) return;
    const started = Date.now();
    const timer = window.setTimeout(onClose, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [kind, onClose, paused]);

  useEffect(() => {
    const onVisibilityChange = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return (
    <motion.div
      className={`app-toast app-toast--${kind}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.36, ease: [0.23, 1, 0.32, 1] }}
      drag={reduceMotion ? false : "y"}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.08, bottom: 0.55 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 48 || info.velocity.y > 550) onClose();
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <span className="app-toast__icon" aria-hidden="true">
        {kind === "error" ? "!" : "✓"}
      </span>
      <div className="app-toast__body">
        <strong>{kind === "error" ? "Something went wrong" : "All set"}</strong>
        <p>{message}</p>
        {onRetry && (
          <button className="app-toast__action" onClick={onRetry} disabled={retryDisabled}>
            Retry <span aria-hidden="true">↗</span>
          </button>
        )}
      </div>
      <button className="app-toast__close" onClick={onClose} aria-label="Dismiss notification">
        ×
      </button>
      {kind === "success" && (
        <span className="app-toast__fuse" style={{ animationPlayState: paused ? "paused" : "running" }} />
      )}
    </motion.div>
  );
}

