import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

/** The motion sequence used by the Settings workspace tabs. */
export default function DashboardContentTransition({ transitionKey, children }: { transitionKey: string; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={transitionKey}
      style={{ width: '100%', minWidth: 0 }}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
      transition={{ duration: 0.19 }}
      transformTemplate={(values, generated) => parseFloat(String(values.y ?? 0)) === 0 ? 'none' : generated}
    >{children}</motion.div>
  </AnimatePresence>;
}
