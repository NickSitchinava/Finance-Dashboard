import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AnalyticsCompare } from '../lib/analyticsDates';

const options: { value: AnalyticsCompare; label: string }[] = [
  { value: 'previous', label: 'Previous period' },
  { value: 'year', label: 'Year over year' },
  { value: 'custom', label: 'Custom period' },
  { value: 'none', label: 'No comparison' },
];
export function AnalyticsCompareSelect({ value, onChange }: { value: AnalyticsCompare; onChange: (value: AnalyticsCompare) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && menu.current) { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, []);
  useEffect(() => { if (open) menu.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus(); }, [open]);
  return <div className="analytics-compare" ref={root}>
    <button ref={trigger} className="analytics-compare-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }}><span>Compare</span><strong>{options.find(item => item.value === value)?.label}</strong><ChevronDown size={15} /></button>
    {open && <div ref={menu} className="analytics-compare-menu" role="listbox" aria-label="Comparison period" onKeyDown={event => { if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return; event.preventDefault(); const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || []); const index = items.indexOf(document.activeElement as HTMLButtonElement); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[next]?.focus(); }}>{options.map(item => <button type="button" role="option" aria-selected={item.value === value} key={item.value} onClick={() => { onChange(item.value); setOpen(false); trigger.current?.focus(); }}>{item.label}</button>)}</div>}
  </div>;
}
