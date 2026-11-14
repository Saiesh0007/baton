import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, animate, motion } from 'motion/react';

export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

// eslint-disable-next-line react-refresh/only-export-components
export function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* One shared IntersectionObserver for everything that animates on first sight. */
const callbacks = new WeakMap<Element, () => void>();
let io: IntersectionObserver | null = null;
function watch(el: Element, cb: () => void) {
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      callbacks.get(e.target)?.();
      io!.unobserve(e.target);
      callbacks.delete(e.target);
    }
  }, { rootMargin: '0px 0px -6% 0px' });
  callbacks.set(el, cb);
  io.observe(el);
  return () => { io?.unobserve(el); callbacks.delete(el); };
}

/**
 * 'rest'  : drawn, no animation (default, also the no-JS and reduced-motion state)
 * 'wait'  : hidden, waiting to scroll into view
 * 'play'  : animating in
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useFirstSight<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<'rest' | 'wait' | 'play'>('rest');
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    setState('wait');
    return watch(el, () => setState('play'));
  }, []);
  return [ref, state] as const;
}

/* Numbers count up (slow out) from where they were to where they are. */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion() || from.current === value) { el.textContent = value + suffix; from.current = value; return; }
    el.textContent = Math.round(from.current) + suffix;
    const c = animate(from.current, value, {
      duration: Math.min(1.1, 0.45 + Math.abs(value - from.current) * 0.012),
      ease: EASE_OUT,
      onUpdate: (v) => { from.current = v; el.textContent = Math.round(v) + suffix; },
    });
    return () => c.stop();
  }, [value, suffix]);
  return <span ref={ref} className="num">{value}{suffix}</span>;
}

/* Long explanations live behind one quiet control instead of on the page. */
export function Explain({ children, label = 'How it works' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="explain">
      <button className="explain-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r=".9" fill="currentColor" />
        </svg>
        {label}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="explain-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion() ? 0 : 0.26, ease: EASE_OUT }}
          >
            <div className="explain-in">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Fades and lifts a page in when it changes (staging), never on every render. */
export function PageIn({ id, children }: { id: string; children: ReactNode }) {
  const [still] = useState(reducedMotion);
  return (
    <motion.div
      key={id}
      initial={still ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/* Runs a callback after `ms`, cancelled on unmount. */
// eslint-disable-next-line react-refresh/only-export-components
export function useLater() {
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
}
