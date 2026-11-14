import { createContext, useEffect, useRef } from 'react';

export interface PassInfo { n: number; v: number; from: string; to: string }

/** Pages ask the shell to play the hand-over; the shell owns it so it can outlive the page that started it. */
// eslint-disable-next-line react-refresh/only-export-components
export const PassCtx = createContext<(p: PassInfo) => void>(() => {});

/*
 * Publishing is the one first-success moment, so it gets exaggeration:
 * the approved claims fly in from where they were (3D), square up into one handover,
 * and the baton crosses from the leaver to the successor. The page changes underneath
 * while the overlay is still opaque, then the overlay lifts off it. Click or Esc skips.
 */
export default function PassOverlay({ n, v, from, to, onSwitch, onDone }: PassInfo & { onSwitch: () => void; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const switched = useRef(false);
  useEffect(() => {
    const doSwitch = () => { if (!switched.current) { switched.current = true; onSwitch(); } };
    const leave = () => ref.current?.classList.add('leaving');
    const timers = [
      window.setTimeout(doSwitch, 2250),
      window.setTimeout(leave, 2300),
      window.setTimeout(onDone, 2700),
    ];
    const skip = () => { doSwitch(); onDone(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') skip(); };
    window.addEventListener('keydown', key);
    const el = ref.current;
    el?.addEventListener('click', skip);
    return () => { timers.forEach(clearTimeout); window.removeEventListener('keydown', key); el?.removeEventListener('click', skip); };
    // runs once per hand-over
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cards = Math.max(3, Math.min(n, 7));
  return (
    <div ref={ref} className="pass" role="status" aria-live="polite">
      <div className="pass-in">
        <div className="pass-stack" aria-hidden="true">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="pass-card" style={{ ['--i' as string]: i, ['--n' as string]: cards }}>
              <span /><span /><span />
            </div>
          ))}
          <div className="pass-doc"><b>Handover v{v}</b><span>{n} approved claim{n === 1 ? '' : 's'}</span></div>
        </div>
        <div className="pass-lane" aria-hidden="true">
          <span className="pass-from">{from}</span>
          <span className="pass-track"><i className="pass-baton" /></span>
          <span className="pass-to">{to}</span>
        </div>
        <p className="pass-line">Handover v{v} is on its way to {to}.</p>
      </div>
    </div>
  );
}
