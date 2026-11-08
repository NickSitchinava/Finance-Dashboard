import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { compactMoney, money } from '../../lib/finance';
import type { Currency } from '../../lib/finance';
import AnimatedMetricValue from './AnimatedMetricValue';

export type FinanceDonutSegment = { label: string; value: number; color: string };
type PointerTooltip = { index: number; x: number; y: number; below: boolean };

const CENTER = 160;
const RADIUS = 108;
const STROKE = 46;

function point(angle: number, radius = RADIUS) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: CENTER + radius * Math.cos(radians), y: CENTER + radius * Math.sin(radians) };
}

function roundedArc(start: number, end: number) {
  const outer = RADIUS + STROKE / 2;
  const inner = RADIUS - STROKE / 2;
  const corner = Math.min(7, (end - start) * Math.PI / 180 * inner / 4);
  const outerOffset = corner / outer * 180 / Math.PI;
  const innerOffset = corner / inner * 180 / Math.PI;
  const outerStart = point(start + outerOffset, outer);
  const outerEnd = point(end - outerOffset, outer);
  const innerEnd = point(end - innerOffset, inner);
  const innerStart = point(start + innerOffset, inner);
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outer} ${outer} 0 ${end - start - 2 * outerOffset > 180 ? 1 : 0} 1 ${outerEnd.x} ${outerEnd.y}`,
    `Q ${point(end, outer).x} ${point(end, outer).y} ${point(end, outer - corner).x} ${point(end, outer - corner).y}`,
    `L ${point(end, inner + corner).x} ${point(end, inner + corner).y}`,
    `Q ${point(end, inner).x} ${point(end, inner).y} ${innerEnd.x} ${innerEnd.y}`,
    `A ${inner} ${inner} 0 ${end - start - 2 * innerOffset > 180 ? 1 : 0} 0 ${innerStart.x} ${innerStart.y}`,
    `Q ${point(start, inner).x} ${point(start, inner).y} ${point(start, inner + corner).x} ${point(start, inner + corner).y}`,
    `L ${point(start, outer - corner).x} ${point(start, outer - corner).y}`,
    `Q ${point(start, outer).x} ${point(start, outer).y} ${outerStart.x} ${outerStart.y} Z`,
  ].join(' ');
}

export function FinanceDonut({ title, label, currency, segments, activeIndex, onActiveChange }: { title: string; label: string; currency: Currency; segments: FinanceDonutSegment[]; activeIndex: number | null; onActiveChange: (index: number | null) => void }) {
  const id = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipTargetRef = useRef<{ x: number; y: number } | null>(null);
  const tooltipCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const tooltipFrameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const [inView, setInView] = useState(() => typeof window === 'undefined' || !('IntersectionObserver' in window));
  const [tooltip, setTooltip] = useState<PointerTooltip | null>(null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const revealKey = segments.map(segment => `${segment.label}:${segment.value}`).join('|');

  const tooltipPosition = (event: ReactPointerEvent<SVGGElement>) => {
    const x = event.clientX + 168 < window.innerWidth ? event.clientX + 14 : Math.max(8, event.clientX - 168);
    const below = event.clientY < 90;
    return { x, y: below ? event.clientY + 14 : event.clientY - 10, below };
  };

  const animateTooltip = (timestamp: number) => {
    const element = tooltipRef.current;
    const target = tooltipTargetRef.current;
    const current = tooltipCurrentRef.current;
    if (!element || !target || !current) {
      tooltipFrameRef.current = null;
      return;
    }
    const seconds = lastFrameRef.current ? Math.min((timestamp - lastFrameRef.current) / 1000, .05) : 1 / 60;
    lastFrameRef.current = timestamp;
    const ease = 1 - Math.exp(-seconds * 9);
    current.x += (target.x - current.x) * ease;
    current.y += (target.y - current.y) * ease;
    element.style.left = `${current.x}px`;
    element.style.top = `${current.y}px`;
    if (Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > .4) {
      tooltipFrameRef.current = requestAnimationFrame(animateTooltip);
    } else {
      element.style.left = `${target.x}px`;
      element.style.top = `${target.y}px`;
      tooltipFrameRef.current = null;
      lastFrameRef.current = 0;
    }
  };

  const moveTooltip = (event: ReactPointerEvent<SVGGElement>) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    const position = tooltipPosition(event);
    tooltipTargetRef.current = position;
    const element = tooltipRef.current;
    if (element) element.style.transform = position.below ? 'translateY(0)' : 'translateY(-100%)';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (tooltipFrameRef.current !== null) cancelAnimationFrame(tooltipFrameRef.current);
      tooltipFrameRef.current = null;
      tooltipCurrentRef.current = { x: position.x, y: position.y };
      if (element) {
        element.style.left = `${position.x}px`;
        element.style.top = `${position.y}px`;
      }
      return;
    }
    if (tooltipFrameRef.current === null) tooltipFrameRef.current = requestAnimationFrame(animateTooltip);
  };

  const showTooltip = (index: number, event: ReactPointerEvent<SVGGElement>) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    const position = tooltipPosition(event);
    tooltipTargetRef.current = position;
    tooltipCurrentRef.current = { x: position.x, y: position.y };
    lastFrameRef.current = 0;
    onActiveChange(index);
    setTooltip({ index, ...position });
  };

  const hideTooltip = () => {
    if (tooltipFrameRef.current !== null) cancelAnimationFrame(tooltipFrameRef.current);
    tooltipFrameRef.current = null;
    tooltipTargetRef.current = null;
    tooltipCurrentRef.current = null;
    lastFrameRef.current = 0;
    onActiveChange(null);
    setTooltip(null);
  };

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (tooltipFrameRef.current !== null) cancelAnimationFrame(tooltipFrameRef.current);
  }, []);

  return <div ref={containerRef} className={`finance-donut ${inView ? 'is-visible' : ''}`}>
    <svg viewBox="0 0 320 320" role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-description`}>{`${label} total: ${money(total, currency)}. `}{segments.map(segment => `${segment.label}: ${Math.round(segment.value / total * 100)}%`).join(', ')}</desc>
      <defs>
        <mask id={`${id}-reveal`} maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="320">
          <circle key={revealKey} cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="white" strokeWidth={STROKE + 26} className="finance-donut__reveal" />
        </mask>
        {segments.map((segment, index) => index % 2 === 1 && <pattern key={index} id={`${id}-stripe-${index}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
          <rect width="8" height="8" fill={segment.color} />
          <path d="M 0 0 V 8" stroke="white" strokeOpacity=".42" strokeWidth="2.5" />
        </pattern>)}
      </defs>
      <g mask={`url(#${id}-reveal)`}>{segments.map((segment, index) => {
        const angle = segments.slice(0, index).reduce((sum, previous) => sum + previous.value / total * 360, 0);
        const sweep = segment.value / total * 360;
        const gap = segments.length === 1 ? 0 : Math.min(2.6, sweep * 0.22);
        const start = angle + gap / 2;
        const end = angle + sweep - gap / 2;
        const midpoint = angle + sweep / 2;
        const labelPoint = point(midpoint);
        const fill = index % 2 === 1 ? `url(#${id}-stripe-${index})` : segment.color;
        const shape = segments.length === 1 ? <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke={fill} strokeWidth={STROKE} /> : <path d={roundedArc(start, end)} fill={fill} />;
        return <g key={`${segment.label}-${index}`} className={`finance-donut__segment ${activeIndex === index ? 'is-active' : ''} ${activeIndex !== null && activeIndex !== index ? 'is-muted' : ''}`} onPointerEnter={event => showTooltip(index, event)} onPointerMove={moveTooltip} onPointerLeave={hideTooltip}>
          <g className="finance-donut__shape" pointerEvents="none">
            {shape}
            {sweep >= 29 && <text x={labelPoint.x} y={labelPoint.y} className="finance-donut__percent" textAnchor="middle" dominantBaseline="central">{Math.round(segment.value / total * 100)}%</text>}
          </g>
          {segments.length === 1 ? <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="transparent" strokeWidth={STROKE} pointerEvents="stroke" /> : <path d={roundedArc(start, end)} fill="transparent" pointerEvents="fill" />}
        </g>;
      })}</g>
    </svg>
    <div className="finance-donut__center-html" aria-hidden="true"><div className="finance-donut__center"><strong><AnimatedMetricValue value={compactMoney(total / 100, currency)}/></strong><span>{label}</span></div></div>
    {tooltip && activeIndex === tooltip.index && segments[tooltip.index] && <div ref={tooltipRef} className="finance-donut__tooltip" style={{ left: tooltip.x, top: tooltip.y, transform: tooltip.below ? 'translateY(0)' : 'translateY(-100%)' }} aria-hidden="true">
      <span className="finance-donut__tooltip-name"><i style={{ backgroundColor: segments[tooltip.index].color }} />{segments[tooltip.index].label}</span>
      <strong><AnimatedMetricValue value={money(segments[tooltip.index].value, currency)}/></strong>
      <small>{Math.round(segments[tooltip.index].value / total * 100)}% of {label.toLowerCase()}</small>
    </div>}
  </div>;
}
