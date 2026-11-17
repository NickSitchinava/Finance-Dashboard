import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import './MobileTabSwitcher.css';

type Props<T extends string> = {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
};

export default function MobileTabSwitcher<T extends string>({ value, options, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  return <>
    <button type="button" className="mobile-tab-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><span>Section</span><strong>{value}</strong><ChevronDown size={15} aria-hidden="true" /></button>
    {open && createPortal(<><button className="mobile-tab-backdrop" type="button" aria-label="Close section switcher" onClick={() => setOpen(false)}/><div className="mobile-tab-sheet" role="dialog" aria-modal="true" aria-label="Choose a section"><div className="mobile-tab-sheet__head"><strong>Choose a section</strong><button type="button" onClick={() => setOpen(false)}>Done</button></div><div className="mobile-tab-sheet__list">{options.map(option => <button type="button" key={option} aria-pressed={option === value} className={option === value ? 'is-active' : ''} onClick={() => { onChange(option); setOpen(false); }}>{option}</button>)}</div></div></>, document.body)}
  </>;
}
