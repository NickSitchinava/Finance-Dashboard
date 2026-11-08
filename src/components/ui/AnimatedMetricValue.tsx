import { useLayoutEffect, useRef, useState } from 'react';
import Counter from './Counter';
import type { CounterProps } from './Counter';

function FittedCounter({ displayText, ...props }: CounterProps & { displayText: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = ref.current;
    const measureElement = measureRef.current;
    const parent = element?.parentElement;
    if (!element || !measureElement || !parent) return;
    let frame = 0;
    const measure = () => {
      const width = measureElement.getBoundingClientRect().width;
      const available = parent.clientWidth;
      if (!width || !available) return;
      const naturalWidth = width / scaleRef.current;
      const next = naturalWidth > available ? Math.max(0.5, (available - 2) / (naturalWidth * 1.01)) : 1;
      if (Math.abs(next - scaleRef.current) < 0.01) return;
      scaleRef.current = next;
      setScale(next);
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(measureElement);
    observer.observe(parent);
    measure();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [displayText]);

  return <span ref={ref} className="animated-metric-fit" style={{ fontSize: `${scale}em`, fontWeight: 'inherit', color: 'inherit', letterSpacing: 'inherit' }}><span ref={measureRef} className="animated-metric-fit__measure" aria-hidden="true">{displayText}</span><Counter {...props} /></span>;
}

/** Preserve the text produced by the existing formatters while rolling its digits. */
export default function AnimatedMetricValue({ value, fit = false }: { value: number | string; fit?: boolean }) {
  const locale = new Intl.NumberFormat().resolvedOptions().locale;
  if (typeof value === 'number') {
    const props: CounterProps = { value, locale, format: { useGrouping: false }, fontSize: 'inherit', fontWeight: 'inherit' };
    return fit ? <FittedCounter {...props} displayText={String(value)}/> : <Counter {...props}/>;
  }

  const match = /^([^\d]*)([\d.,\s\u00a0\u202f]+?)([^\d]*)$/.exec(value);
  if (!match) return value;
  const [, prefix, raw, suffix] = match;
  const decimal = new Intl.NumberFormat().formatToParts(1.1).find(part => part.type === 'decimal')?.value ?? '.';
  const group = new Intl.NumberFormat().formatToParts(1000).find(part => part.type === 'group')?.value ?? ',';
  const last = raw.lastIndexOf(decimal);
  const decimals = last < 0 ? 0 : raw.length - last - decimal.length;
  if (decimals > 6) return value;
  const numeric = Number(raw.replaceAll(group, '').replace(decimal, '.').replace(/[^\d.]/g, ''));
  const formatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (!Number.isFinite(numeric) || formatter.format(numeric) !== raw) return value;
  const props: CounterProps = { value: numeric, locale, decimals, prefix, suffix, fontSize: 'inherit', fontWeight: 'inherit' };
  return fit ? <FittedCounter {...props} displayText={value}/> : <Counter {...props}/>;
}
