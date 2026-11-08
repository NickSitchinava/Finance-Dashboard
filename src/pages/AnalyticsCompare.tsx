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
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, []);
  return <div className="analytics-compare" ref={root}>
    <button className="analytics-compare-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}><span>Compare</span><strong>{options.find(item => item.value === value)?.label}</strong><ChevronDown size={15} /></button>
    {open && <div className="analytics-compare-menu" role="listbox" aria-label="Comparison period">{options.map(item => <button type="button" role="option" aria-selected={item.value === value} key={item.value} onClick={() => { onChange(item.value); setOpen(false); }}>{item.label}</button>)}</div>}
  </div>;
}
