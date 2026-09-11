import { useEffect, useRef } from 'react';
import { motion, useAnimationControls, useInView } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

type Props = HTMLMotionProps<'div'> & { as?: 'div' | 'section' | 'article'; disabled?: boolean };
// Server and first browser render are visible. Only offscreen sections are
// prepared for entrance animations after hydration; no-JS users see everything.
export default function Reveal({ as = 'div', disabled, initial, whileInView, viewport, ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const visible = useInView(ref, { once: true, amount: viewport?.amount ?? 0.12 });
  const prepared = useRef(false);
  const played = useRef(false);
  useEffect(() => {
    const target = typeof whileInView === 'object' ? whileInView : { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 };
    if (disabled) { controls.set(target); return; }
    if (!prepared.current) {
      prepared.current = true;
      if (ref.current && ref.current.getBoundingClientRect().top >= window.innerHeight && typeof initial === 'object') controls.set(initial);
    }
    if (visible && !played.current) {
      played.current = true;
      void controls.start(target);
    }
  }, [controls, disabled, initial, visible, whileInView]);
  const Component = as === 'section' ? motion.section : as === 'article' ? motion.article : motion.div;
  return <Component {...props} ref={ref} initial={false} animate={controls} />;
}
