import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Archive, RotateCcw } from 'lucide-react';
import './FuseButton.css';

type Phase = 'idle' | 'armed';

export default function FuseButton({
  label = 'Archive',
  undoLabel = 'Undo',
  color = '#f5f5f5',
  background = '#27272a',
  fuseColor = '#f5a524',
  size = 'md',
  radius = 22,
  undoWindow = 4000,
  fuseThickness = 1.5,
  crossfadeMs = 200,
  pauseOnHover = true,
  disabled = false,
  icon,
  armedStatus = 'Archived. Undo available.',
  beforeCommit,
  onCommit,
  onUndo,
  onFuseEnd,
}: {
  label?: string;
  undoLabel?: string;
  color?: string;
  background?: string;
  fuseColor?: string;
  size?: 'sm' | 'md' | 'lg';
  radius?: number;
  undoWindow?: number;
  fuseThickness?: number;
  crossfadeMs?: number;
  pauseOnHover?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  armedStatus?: string;
  beforeCommit?: () => Promise<boolean>;
  onCommit?: () => void;
  onUndo?: () => void;
  onFuseEnd?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const root = useRef<HTMLSpanElement>(null);
  const rim = useRef<SVGRectElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const animation = useRef<Animation | null>(null);
  const preparing = useRef(false);
  const pause = useRef({ hover: false, hidden: false, canHoverPause: false });
  const statusId = useId();
  const dimensions = { sm: [36, 13, 16], md: [44, 14, 20], lg: [52, 15, 24] }[size];

  const syncPlayState = () => {
    const current = animation.current;
    if (!current) return;
    if (pause.current.hover || pause.current.hidden) current.pause();
    else if (current.playState === 'paused') current.play();
  };

  const arm = async () => {
    if (disabled || phase !== 'idle' || !rim.current || preparing.current) return;
    preparing.current = true;
    let confirmed = true;
    try {
      confirmed = await beforeCommit?.() ?? true;
    } catch {
      confirmed = false;
    }
    preparing.current = false;
    if (!confirmed || !rim.current) return;
    pause.current.hover = false;
    pause.current.canHoverPause = false;
    onCommit?.();
    setPhase('armed');
    const current = rim.current.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -1 }], {
      duration: undoWindow,
      easing: 'linear',
      fill: 'forwards',
    });
    animation.current = current;
    current.onfinish = () => {
      animation.current = null;
      onFuseEnd?.();
      setPhase('idle');
    };
    syncPlayState();
  };

  const undo = () => {
    if (phase !== 'armed') return;
    if (animation.current) {
      animation.current.onfinish = null;
      animation.current.cancel();
      animation.current = null;
    }
    onUndo?.();
    setPhase('idle');
  };

  useEffect(() => {
    if (phase !== 'armed') return;
    const frame = requestAnimationFrame(() => undoButton.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    const onVisibility = () => {
      pause.current.hidden = document.hidden;
      syncPlayState();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      animation.current?.cancel();
    };
  }, []);

  return (
    <span
      ref={root}
      className="fuse-button"
      data-phase={phase}
      style={{
        '--fb-ink': color,
        '--fb-bg': background,
        '--fb-fuse': fuseColor,
        '--fb-fuse-h': `${fuseThickness}px`,
        '--fb-radius': `${radius}px`,
        '--fb-fade': `${crossfadeMs}ms`,
        '--fb-h': `${dimensions[0]}px`,
        '--fb-fs': `${dimensions[1]}px`,
        '--fb-px': `${dimensions[2]}px`,
      } as CSSProperties}
      onPointerEnter={(event) => {
        if (pauseOnHover && event.pointerType === 'mouse' && pause.current.canHoverPause) {
          pause.current.hover = true;
          syncPlayState();
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return;
        pause.current.canHoverPause = true;
        pause.current.hover = false;
        syncPlayState();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && phase === 'armed') {
          event.preventDefault();
          event.stopPropagation();
          undo();
        }
      }}
    >
      <button type="button" className="fuse-button__face fuse-button__idle" disabled={disabled || phase !== 'idle'} onClick={arm}>
        {icon ?? <Archive size={15} aria-hidden="true" />}{label}
      </button>
      <button ref={undoButton} type="button" className="fuse-button__face fuse-button__undo" disabled={phase !== 'armed'} onClick={undo} aria-describedby={statusId} aria-keyshortcuts="Escape">
        <RotateCcw size={15} aria-hidden="true" />{undoLabel}
      </button>
      <svg className="fuse-button__rim" aria-hidden="true"><rect ref={rim} pathLength="1" /></svg>
      <span className="fuse-button__status" id={statusId} role="status" aria-live="polite">{phase === 'armed' ? armedStatus : ''}</span>
    </span>
  );
}
