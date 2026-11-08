import { useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLInputTypeAttribute } from "react";
import { Eye, EyeOff } from "lucide-react";

/* ══ Label input ══════════════════════════════════════════
   A field whose label is its placeholder until you are in it.
   On focus the label lifts into the top edge with a small hop
   running along its letters, the outline darkens in place, and
   the top line parts under the label from its middle outward.

   ── ONE THING MOVES ─────────────────────────────────────
   It used to DRAW its outline out of the notch, both ways
   round the field — and that was the field performing, which
   is too much for a thing you focus forty times a day. Now the
   outline is always whole; focus only changes its ink and
   opens the gap. The label is the event, and the line makes
   room for it.

   The gap is two short paths across the notch, each from the
   middle to one side, retracted from the middle outward by a
   negative dash offset. */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const W = 280;
const H = 52;
/* the lifted label's size, against its resting one */
const S = 0.78;
/* the stroke sits half a stroke inside the box so none of it
   is clipped by the svg's own edge */
const IN = 0.75;

export function LabelInput({
  field = "Email",
  /* the field's corner, px — at half the height it is a pill */
  corner = 20,
  /* a showcase, not a form: on a touch screen, keep the device's
     keyboard down. Off by default — a real field wants its
     keyboard — and the bench turns it on for its feed */
  showcase = false,
  id: providedId,
  type,
  value: controlledValue,
  onChange,
  autoComplete,
  required,
  minLength,
  inputMode,
  invalid,
  describedBy,
  error,
  shakeToken = 0,
}: {
  field?: string;
  corner?: number;
  showcase?: boolean;
  id?: string;
  type?: HTMLInputTypeAttribute;
  value?: string;
  onChange?: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  invalid?: boolean;
  describedBy?: string;
  error?: string;
  shakeToken?: number;
} = {}) {
  const r = clamp(corner, 0, H / 2);
  const secret = type === "password" || (type === undefined && field === "Password");
  const label = field;
  const generatedId = `lbi-${useId().replace(/:/g, "")}`;
  const id = providedId ?? generatedId;

  const [focus, setFocus] = useState(false);
  const [quiet] = useState(() => showcase && typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const [localValue, setLocalValue] = useState("");
  const value = controlledValue ?? localValue;
  const lastValue = useRef(value);
  useLayoutEffect(() => { lastValue.current = value; }, [value]);
  const [show, setShow] = useState(false);
  const [flip, setFlip] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!shakeToken || !box.current) return;
    const node = box.current;
    node.classList.remove("is-shaking");
    void node.offsetWidth;
    node.classList.add("is-shaking");
    const timer = window.setTimeout(() => node.classList.remove("is-shaking"), 280);
    return () => { window.clearTimeout(timer); node.classList.remove("is-shaking"); };
  }, [shakeToken]);
  const [width, setWidth] = useState(W);
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWidth(node.getBoundingClientRect().width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* the notch is the label's own width, so it is measured */
  const lab = useRef<HTMLLabelElement | null>(null);
  const [lw, setLw] = useState(40);
  useLayoutEffect(() => {
    if (lab.current) setLw(lab.current.offsetWidth);
  }, [label]);

  const up = focus || value.length > 0;

  /* ── where the label sits, and the gap it leaves ─────────
     Never inside the corner's curve: the notch has to open on
     the straight part of the top edge, so a rounder field
     starts its label further in. */
  const lx = Math.max(14, r + 4);
  const x0 = Math.max(r * 0.6, lx - 5);
  const x1 = lx + lw * S + 5;
  const a = r - IN;
  const R = width - IN;
  const B = H - IN;
  const mid = width / 2;
  /* the gap, as two halves from its middle to each side */
  const nm = (x0 + x1) / 2;
  const gapL = `M${nm},${IN} L${x0},${IN}`;
  const gapR = `M${nm},${IN} L${x1},${IN}`;
  /* right: from the notch, clockwise, to the bottom middle */
  const right = r > 0
    ? `M${x1},${IN} L${width - r},${IN} A${a},${a} 0 0 1 ${R},${r} L${R},${H - r} A${a},${a} 0 0 1 ${width - r},${B} L${mid},${B}`
    : `M${x1},${IN} L${R},${IN} L${R},${B} L${mid},${B}`;
  /* left: from the notch, the other way round, to the same point */
  const left = r > 0
    ? `M${x0},${IN} L${r},${IN} A${a},${a} 0 0 0 ${IN},${r} L${IN},${H - r} A${a},${a} 0 0 0 ${r},${B} L${mid},${B}`
    : `M${x0},${IN} L${IN},${IN} L${IN},${B} L${mid},${B}`;

  const reveal = () => {
    setShow((s) => !s);
    setFlip((f) => f + 1);
  };

  const syncValue = (next: string) => {
    if (next === lastValue.current) return;
    lastValue.current = next;
    if (controlledValue === undefined) setLocalValue(next);
    onChange?.(next);
  };

  return (
    <div className="lbi" data-up={up} data-focus={focus} data-filled={value.length > 0} data-error={Boolean(error || invalid)}>
      <div
        className="lbi-box"
        ref={box}
        style={{ width: "100%", height: H, borderRadius: r, "--lbi-x": `${lx}px` } as CSSProperties}
      >
        <svg className="lbi-ring" width="100%" height={H} viewBox={`0 0 ${width} ${H}`} aria-hidden="true">
          <path d={right} />
          <path d={left} />
          <path className="lbi-gap" d={gapL} pathLength={1} />
          <path className="lbi-gap" d={gapR} pathLength={1} />
        </svg>

        <label className="lbi-label" htmlFor={id} ref={lab}>
          {[...label].map((ch, i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>{ch}</span>
          ))}
        </label>

        <input
          ref={input}
          id={id}
          aria-label={label}
          className="lbi-field"
          data-flip={flip % 2}
          /* ── no autofill, when it is only being shown ───────
             An email or password box is an invitation: the browser
             drops its saved addresses under it, a password manager
             pins its badge in it, the phone offers a contact. On
             the bench it is a preview, not a form, so it is a plain
             text field — a hidden password masked by the font
             rather than by the type — named so Safari takes it for
             a search, and marked off for the managers that read
             their own attribute. A real use keeps the real types. */
          type={showcase ? "text" : secret && !show ? "password" : secret ? "text" : type ?? "email"}
          name={showcase ? "search-preview" : undefined}
          data-1p-ignore={showcase || undefined}
          data-lpignore={showcase ? "true" : undefined}
          data-bwignore={showcase || undefined}
          data-form-type={showcase ? "other" : undefined}
          autoCorrect="off"
          autoCapitalize={type === "text" ? "words" : "off"}
          value={value}
          onInput={(e) => syncValue(e.currentTarget.value)}
          onChange={(e) => syncValue(e.target.value)}
          onAnimationStart={(e) => { if (e.animationName === "lbi-autofill") syncValue(input.current?.value ?? ""); }}
          onFocus={() => { setFocus(true); if (input.current) syncValue(input.current.value); }}
          onBlur={() => { setFocus(false); if (input.current) syncValue(input.current.value); }}
          autoComplete={autoComplete ?? "off"}
          required={required}
          minLength={minLength}
          inputMode={quiet ? "none" : inputMode}
          aria-invalid={Boolean(error || invalid) || undefined}
          aria-describedby={[describedBy, error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined}
          spellCheck={false}
          /* ── no keyboard, when it is only being shown ─────
             In a feed you are scrolling on a phone, a tap that
             lands on the field threw the keyboard up over the
             page. inputMode "none" keeps everything the block is
             about — the focus, the label lifting, the gap
             opening — and only tells the device not to raise its
             keyboard. A mouse and a hardware keyboard are
             untouched, and so is any real use of this field. */
          style={{
            paddingRight: secret ? 48 : lx,
            ...(showcase && secret && !show ? { WebkitTextSecurity: "disc" } : {}),
          } as CSSProperties}
        />

        {secret && (
          <button
            className="lbi-eye"
            type="button"
            data-show={show}
            /* keep focus in the field: the eye is a toggle on
               what you are typing, not somewhere to go */
            onPointerDown={(e) => e.preventDefault()}
            onClick={reveal}
            aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={show}
          >
            <Eye size={16} strokeWidth={2} aria-hidden="true" />
            <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="lbi-error-msg" id={`${id}-error`} aria-live="polite">{error}</p>
    </div>
  );
}
