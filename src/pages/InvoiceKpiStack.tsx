import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { animate, motion, motionValue, useReducedMotion } from 'motion/react';
import type { MotionValue } from 'motion/react';

type Values = {
  x: MotionValue<number>;
  y: MotionValue<number>;
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  tiltY: MotionValue<number>;
  spin: MotionValue<number>;
  lift: MotionValue<number>;
  z: MotionValue<number>;
  opacity: MotionValue<number>;
  shade: MotionValue<number>;
};

type Drag = {
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  progress: number;
  samples: [number, number][];
};

const SPRINGS = {
  place: [260, 24],
  settle: [320, 34],
  tuck: [240, 28],
  lean: [240, 28],
  press: [420, 34],
  fling: [650, 42],
} as const;
const THRESHOLD = 90;
const FLICK_SPEED = 650;
const VISIBLE = 4;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const placement = (position: number) => ({ y: -position * 0.5 * 32, rotate: 0, scale: 1 - position * 0.5 * 0.1, shade: Math.min(0.6, position * 0.07) });

export default function InvoiceKpiStack({ cards, labels }: { cards: ReactNode[]; labels: string[] }) {
  const count = cards.length;
  const reduceMotion = Boolean(useReducedMotion());
  const rootRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState(() => cards.map((_, index) => index));
  const orderRef = useRef(order);
  const [cardValues] = useState<Values[]>(() => cards.map((_, index) => {
    const place = placement(index);
    return {
      x: motionValue(0),
      y: motionValue(place.y),
      rotate: motionValue(place.rotate),
      scale: motionValue(place.scale),
      tiltY: motionValue(0),
      spin: motionValue(0),
      lift: motionValue(1),
      z: motionValue(cards.length - index),
      opacity: motionValue(index < VISIBLE ? 1 : 0),
      shade: motionValue(place.shade),
    };
  }));
  const dragRef = useRef<Drag | null>(null);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);

  const valuesFor = (index: number) => cardValues[index];

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      cardValues.forEach(group => Object.values(group).forEach(value => value.stop()));
    };
  }, [cardValues]);

  const spring = (kind: keyof typeof SPRINGS, velocity = 0) => {
    const [stiffness, damping] = SPRINGS[kind];
    return { type: 'spring' as const, stiffness, damping, velocity, restDelta: 0.01, restSpeed: 0.5 };
  };

  const settleFace = (values: Values) => {
    if (reduceMotion) {
      values.tiltY.set(0);
      values.spin.set(0);
      values.lift.set(1);
      return;
    }
    animate(values.tiltY, 0, spring('lean'));
    animate(values.spin, 0, spring('lean'));
    animate(values.lift, 1, spring('press'));
  };

  const placeCard = (index: number, position: number, kind: keyof typeof SPRINGS = 'place') => {
    const values = valuesFor(index);
    const place = placement(Math.min(position, VISIBLE - 1));
    values.z.set(count - position);
    if (reduceMotion) {
      values.x.set(0);
      values.y.set(place.y);
      values.rotate.set(place.rotate);
      values.scale.set(place.scale);
      values.opacity.set(position < VISIBLE ? 1 : 0);
      values.shade.set(place.shade);
      settleFace(values);
      return;
    }
    animate(values.y, place.y, spring(kind));
    animate(values.rotate, place.rotate, spring(kind));
    animate(values.scale, place.scale, spring(kind));
    animate(values.opacity, position < VISIBLE ? 1 : 0, { duration: 0.35, ease: 'easeOut' });
    animate(values.shade, place.shade, { duration: 0.35, ease: 'easeOut' });
    settleFace(values);
  };

  const sendToBack = (target: number, direction: -1 | 1, velocity = 0) => {
    const current = orderRef.current;
    if (busyRef.current || current.length < 2 || target === current[0]) return;
    const front = current[0];
    const next = [target, ...current.filter(index => index !== target && index !== front), front];
    const values = valuesFor(front);
    busyRef.current = true;
    orderRef.current = next;
    setOrder(next);
    next.forEach((index, position) => {
      if (index !== front) placeCard(index, position);
    });
    settleFace(values);
    if (reduceMotion) {
      placeCard(front, next.length - 1);
      busyRef.current = false;
      return;
    }
    values.z.set(count + 1);
    const distance = (rootRef.current?.clientWidth || 280) * 1.12 + 40;
    const flight = animate(values.x, direction * distance, spring('fling', velocity));
    void flight.finished.then(() => {
      if (!aliveRef.current) return;
      const position = next.length - 1;
      const place = placement(Math.min(position, VISIBLE - 1));
      values.z.set(count - position);
      animate(values.y, place.y, spring('tuck'));
      animate(values.rotate, place.rotate, spring('tuck'));
      animate(values.scale, place.scale, spring('tuck'));
      animate(values.opacity, 0, { duration: 0.35, ease: 'easeOut' });
      animate(values.shade, place.shade, { duration: 0.35, ease: 'easeOut' });
      const tuck = animate(values.x, 0, spring('tuck'));
      void tuck.finished.then(() => { if (aliveRef.current) busyRef.current = false; }).catch(() => { busyRef.current = false; });
    }).catch(() => { busyRef.current = false; });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0 || busyRef.current || dragRef.current || orderRef.current[0] !== index) return;
    dragRef.current = { index, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, progress: 0, samples: [[event.clientX, event.timeStamp]] };
    if (!reduceMotion) animate(valuesFor(index).lift, 1.035, spring('press'));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy)) return;
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const values = valuesFor(drag.index);
    values.x.set(dx);
    drag.samples.push([event.clientX, event.timeStamp]);
    if (drag.samples.length > 12) drag.samples.shift();
    const recent = drag.samples.filter(sample => event.timeStamp - sample[1] <= 100);
    const velocity = recent.length < 2 ? 0 : (recent.at(-1)![0] - recent[0][0]) / Math.max((recent.at(-1)![1] - recent[0][1]) / 1000, 0.008);
    if (!reduceMotion) {
      const sideways = clamp(velocity / 1300, -1, 1) * 0.7 + clamp(dx / 260, -1, 1) * 0.3;
      animate(values.tiltY, sideways * 30, spring('lean'));
      animate(values.spin, clamp(dx / 260, -1, 1) * 6, spring('lean'));
      const progress = clamp(Math.abs(dx) / THRESHOLD, 0, 1);
      if (Math.abs(progress - drag.progress) > 0.02) {
        drag.progress = progress;
        orderRef.current.slice(1).forEach((index, offset) => {
          const position = Math.min(offset + 1, VISIBLE - 1);
          const behind = placement(position);
          const ahead = placement(position - 1);
          const lift = progress * 0.4;
          const card = valuesFor(index);
          animate(card.y, behind.y + (ahead.y - behind.y) * lift, spring('settle'));
          animate(card.rotate, behind.rotate + (ahead.rotate - behind.rotate) * lift, spring('settle'));
          animate(card.scale, behind.scale + (ahead.scale - behind.scale) * lift, spring('settle'));
        });
      }
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const values = valuesFor(drag.index);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const dx = event.clientX - drag.startX;
    const recent = drag.samples.filter(sample => event.timeStamp - sample[1] <= 100);
    const velocity = recent.length < 2 ? 0 : (recent.at(-1)![0] - recent[0][0]) / Math.max((recent.at(-1)![1] - recent[0][1]) / 1000, 0.008);
    const flick = Math.abs(velocity) > FLICK_SPEED && Math.abs(dx) > 16 && velocity * dx > 0;
    if (event.type === 'pointerup' && drag.moved && (Math.abs(dx) > THRESHOLD || flick)) {
      sendToBack(orderRef.current[1], dx < 0 ? -1 : 1, velocity);
    } else {
      if (reduceMotion) values.x.set(0);
      else animate(values.x, 0, spring('settle', velocity));
      settleFace(values);
      if (drag.progress) orderRef.current.slice(1).forEach((index, offset) => placeCard(index, offset + 1, 'settle'));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); sendToBack(orderRef.current[1], -1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); sendToBack(orderRef.current.at(-1)!, 1); }
  };

  return <div className="invoice-kpi-stack-wrap">
    <div ref={rootRef} className="invoice-kpi-stack" role="group" aria-label="Invoice summary cards" tabIndex={0} onKeyDown={onKeyDown}>
      {cards.map((card, index) => {
        const values = valuesFor(index);
        const isTop = order[0] === index;
        return <motion.div key={index} className="invoice-kpi-stack-card" data-top={isTop ? '' : undefined} aria-hidden={!isTop} style={{ x: values.x, y: values.y, rotate: values.rotate, scale: values.scale, originX: 0.5, originY: 0, zIndex: values.z, opacity: values.opacity, touchAction: isTop ? 'pan-y' : 'auto', pointerEvents: isTop ? 'auto' : 'none' }} onPointerDown={event => onPointerDown(event, index)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <motion.div className="invoice-kpi-stack-face" style={{ rotateY: values.tiltY, rotate: values.spin, scale: values.lift, transformPerspective: 800 }}>
            {card}
            <motion.div className="invoice-kpi-stack-shade" style={{ opacity: values.shade }} />
          </motion.div>
        </motion.div>;
      })}
    </div>
    <div className="invoice-kpi-dots" role="group" aria-label="Choose invoice summary card">
      {labels.map((label, index) => <button key={label} type="button" aria-label={`Show ${label}`} aria-current={order[0] === index ? 'true' : undefined} onClick={() => sendToBack(index, order.indexOf(index) > count / 2 ? 1 : -1)} />)}
    </div>
  </div>;
}
