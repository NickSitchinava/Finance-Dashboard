import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays } from 'lucide-react';
import './MobilePeriodPicker.css';

export function useMobilePeriodPicker() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 800px)');
    const update = () => setMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}

type Props<T extends string> = {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  custom?: ReactNode;
};

export default function MobilePeriodPicker<T extends string>({ value, options, onChange, custom }: Props<T>) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);
  const label = options.find(option => option.value === value)?.label ?? value;
  return <>
    <button type="button" className="mobile-period-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><CalendarDays size={16} /> Period <strong>{label}</strong></button>
    {open && createPortal(<><button type="button" className="mobile-period-backdrop" aria-label="Close period picker" onClick={() => setOpen(false)} /><div className="mobile-period-sheet" role="dialog" aria-modal="true" aria-label="Pick a period"><div className="mobile-period-sheet__head"><strong>Pick a period</strong><button type="button" onClick={() => setOpen(false)}>Done</button></div><div className="mobile-period-sheet__options">{options.map(option => <button type="button" key={option.value} className={value === option.value ? 'is-active' : ''} aria-pressed={value === option.value} onClick={() => { onChange(option.value); if (option.value !== 'custom') setOpen(false); }}>{option.label}</button>)}</div>{value === 'custom' && <div className="mobile-period-sheet__custom">{custom}</div>}</div></>, document.body)}
  </>;
}
