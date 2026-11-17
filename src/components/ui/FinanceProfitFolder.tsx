import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import AnimatedMetricValue from './AnimatedMetricValue';
import { useProfile } from '../auth/ProfileContext';
import './FinanceProfitFolder.css';

const CONTOURS = Array.from({ length: 18 }, (_, index) => 72 + index * 24);

export default function FinanceProfitFolder({ value }: { value: string }) {
  const { fullName } = useProfile();
  const name = fullName?.trim() || 'Your finances';
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const reduce = useReducedMotion();
  const progress = useMotionValue(0);
  const cardTransform = useTransform(progress, current => { const lift = Math.sin(Math.PI * Math.min(1, Math.max(0, current))); return `translateY(${-8 * lift}%) scale(${1 + .01 * lift})`; });
  const backTransform = useTransform(progress, [0, 1], ['translateY(0%) scaleY(1)', 'translateY(18%) scaleY(0.18)']);
  const frontTransform = useTransform(progress, [0, 1], ['translateY(0%) rotateX(0deg)', 'translateY(18%) rotateX(-72deg)']);
  const sleeveOpacity = useTransform(progress, [0, .76, 1], [1, 1, 0]);
  useEffect(() => { const controls = animate(progress, open ? 1 : 0, reduce ? { duration: 0 } : { duration: .28, ease: [.45, 0, .55, 1] }); return () => controls.stop(); }, [open, progress, reduce]);

  return <div className="finance-profit-folder" data-open={open}>
    <motion.div className="finance-profit-folder__back" aria-hidden="true" style={reduce ? undefined : { transform: backTransform, opacity: sleeveOpacity }} animate={reduce ? { opacity: open ? 0 : 1 } : undefined} />
    <motion.button type="button" className="finance-profit-folder__card" aria-label={`${open ? 'Close' : 'Open'} net profit details`} aria-expanded={open} onClick={() => setOpen(current => !current)} style={reduce ? undefined : { transform: cardTransform }} whileTap={reduce ? undefined : { scale: .96 }} transition={{ type: 'spring', duration: .3, bounce: 0 }}>
      <span className="finance-profit-folder__art">
        <svg className="finance-profit-folder__contours" viewBox="0 0 640 404" aria-hidden="true">{CONTOURS.map((radius, index) => <circle key={radius} cx="-20" cy="-28" r={radius} fill="none" stroke="currentColor" strokeOpacity={.32 - index * .009} strokeWidth="1.5" />)}</svg>
        <span className="finance-profit-folder__shine" aria-hidden="true" />
        <span className="finance-profit-folder__art-top"><span>{name}</span></span>
        <span className="finance-profit-folder__chip" aria-hidden="true"><i/><i/><i/><i/><i/><i/></span>
        <span className="finance-profit-folder__art-value"><small>Net profit</small><strong>{visible ? <AnimatedMetricValue value={value} fit /> : '••••••'}</strong></span>
        <span className="finance-profit-folder__art-bottom"><span>Income minus Expenses</span><span>{open ? 'Tap to close' : 'Tap to open'}</span></span>
      </span>
    </motion.button>
    <motion.div className="finance-profit-folder__front" aria-hidden={open} inert={open} style={reduce ? undefined : { transform: frontTransform, opacity: sleeveOpacity }} animate={reduce ? { opacity: open ? 0 : 1 } : undefined}>
      <svg className="finance-profit-folder__front-shape" viewBox="0 0 384 110" preserveAspectRatio="none" aria-hidden="true"><path d="M0 17C15 7 31 4 49 4H87C110 4 126 17 144 32L158 44C176 59 206 59 225 43L240 30C257 16 271 4 295 4H335C354 4 370 8 384 18V94C384 103 377 110 368 110H16C7 110 0 103 0 94Z" fill="#292532" stroke="#80758e" strokeOpacity=".35" vectorEffect="non-scaling-stroke"/><path d="M10 21C22 13 35 11 51 11H85C105 11 120 23 137 37L153 50C175 68 208 68 231 49L246 36C262 23 275 11 297 11H333C350 11 363 14 374 22V89C374 97 369 101 360 101H24C15 101 10 96 10 89Z" fill="none" stroke="#b9adca" strokeDasharray="5 5" strokeLinecap="round" strokeOpacity=".3" vectorEffect="non-scaling-stroke"/></svg>
      <div className="finance-profit-folder__front-content"><div className="finance-profit-folder__front-bottom"><strong>{name}</strong><motion.button type="button" className="finance-profit-folder__visibility" aria-label={visible ? 'Hide net profit amount' : 'Show net profit amount'} aria-pressed={visible} onClick={() => setVisible(current => !current)} whileTap={reduce ? undefined : { scale: .96 }} transition={reduce ? { duration: .12 } : { type: 'spring', duration: .3, bounce: 0 }}><AnimatePresence initial={false} mode="popLayout"><motion.span key={visible ? 'hide' : 'show'} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: .25, filter: 'blur(4px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={reduce ? { opacity: 0 } : { opacity: 0, scale: .25, filter: 'blur(4px)' }} transition={reduce ? { duration: .12 } : { type: 'spring', duration: .3, bounce: 0 }}>{visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</motion.span></AnimatePresence></motion.button></div></div>
    </motion.div>
  </div>;
}
