import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { InkMark } from '../ui';
import { reducedMotion } from '../motion';

/*
 * The hero: Baton doing its job on the real demo data, in 3D.
 *  1 a notes line is found (highlight sweep), a thread draws to the claim, the quote settles in, a tick is inked
 *  3-4 a commit confirms it: second thread, second tick, "Corroborated"
 *  5 a chat message and a merged PR disagree: red thread, ≠ lands, a question for Aarav
 *  6 a human approves: the stamp lifts, then strikes
 *  7 the claim is passed forward to Diya
 *  8 everything that changed fades, and the loop starts again
 */
const TIMELINE: [number, number][] = [
  [250, 1], [900, 2], [2050, 3], [2700, 4], [4150, 5], [6300, 6], [7500, 7], [9150, 8],
];
const LOOP = 9700;
const REST = 6; // the composed frame shown with reduced motion
const STEP_OF = (p: number) => (p >= 6 ? 3 : p >= 5 ? 2 : p >= 1 ? 1 : 0);

type Pt = [number, number];

export default function Stage() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const neqRef = useRef<HTMLDivElement>(null);
  const [still] = useState(reducedMotion);
  // ?stage=N holds the scene on one beat (used to check each pose)
  const [held] = useState(() => { const n = Number(new URLSearchParams(window.location.search).get('stage')); return n >= 0 && n <= 8 && Number.isInteger(n) && window.location.search.includes('stage=') ? n : null; });
  const [phase, setPhase] = useState(held ?? (still ? REST : 0));
  const [snap, setSnap] = useState(false);
  useEffect(() => {
    // development only: lets a capture script jump between beats to read each transition
    if (import.meta.env.DEV) (window as unknown as { __stage?: (n: number) => void }).__stage = setPhase;
  }, []);

  /* Timeline: pose to pose, paused while the stage is off screen. */
  useEffect(() => {
    if (still || held !== null) return;
    let timers: number[] = [];
    let visible = true;
    let owed = false;
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const run = () => {
      clear();
      setSnap(true);
      setPhase(0);
      timers.push(window.setTimeout(() => setSnap(false), 60));
      for (const [t, p] of TIMELINE) timers.push(window.setTimeout(() => setPhase(p), t));
      timers.push(window.setTimeout(() => { if (visible) run(); else owed = true; }, LOOP));
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && owed) { owed = false; run(); }
    });
    io.observe(sceneRef.current!);
    run();
    return () => { clear(); io.disconnect(); };
  }, [still, held]);

  /* Fit the rig to its box (the scene is composed at 760 × 640). */
  useLayoutEffect(() => {
    const scene = sceneRef.current!;
    const fit = () => {
      const s = Math.min(1, scene.clientWidth / 800, scene.clientHeight / 720);
      scene.style.setProperty('--fit', String(Math.max(0.4, s)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(scene);
    return () => ro.disconnect();
  }, []);

  /* Camera follows the pointer (true perspective, so layers parallax by depth); threads follow the cards. */
  useEffect(() => {
    const scene = sceneRef.current!;
    const rig = rigRef.current!;
    const svg = svgRef.current!;
    const stage = scene.closest('.stage') as HTMLElement | null;
    const fine = !still && window.matchMedia('(pointer: fine)').matches;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, on = true;
    const move = (e: PointerEvent) => {
      const r = scene.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    };
    const leave = () => { tx = 0; ty = 0; };
    if (fine && stage) { stage.addEventListener('pointermove', move); stage.addEventListener('pointerleave', leave); }

    const q = (sel: string) => scene.querySelector(sel) as HTMLElement;
    const card = q('.claim-3d');
    const notes = q('.notes');
    const a ={ s: q('[data-a="notes"]'), e: q('[data-a="slot-a"]') };
    const b = { s: q('[data-a="commit"]'), e: q('[data-a="slot-b"]') };
    const c = { s: q('[data-a="chat"]'), e: q('[data-a="pr"]') };
    const pa = svg.querySelector('.th-a') as SVGPathElement;
    const pb = svg.querySelector('.th-b') as SVGPathElement;
    const pc = svg.querySelector('.th-c') as SVGPathElement;

    const threads = () => {
      const o = scene.getBoundingClientRect();
      const box = (el: HTMLElement) => el.getBoundingClientRect();
      const mid = (r: DOMRect, side: 'l' | 'r' | 'b'): Pt =>
        side === 'b' ? [r.left + r.width / 2 - o.left, r.bottom - o.top]
          : [side === 'l' ? r.left - o.left : r.right - o.left, r.top + r.height / 2 - o.top];
      const cr = box(card);
      // A: off the notes page beside the quoted line, round the left of the claim, tied on beside the first quote
      const ar = box(a.s);
      const nr = box(notes);
      const as: Pt = [nr.left - o.left - 2, ar.top + ar.height / 2 - o.top];
      const ae: Pt = [cr.left - o.left - 3, mid(box(a.e), 'l')[1]];
      pa.setAttribute('d', `M${as[0]} ${as[1]} C${as[0] - 56} ${as[1] + 50} ${ae[0] - 84} ${ae[1]} ${ae[0]} ${ae[1]}`);
      // B: out of the commit, round the right of the claim, tied on beside the second quote
      const br = box(b.s);
      const bs: Pt = [br.left - o.left + br.width * 0.72, br.bottom - o.top];
      const be: Pt = [cr.right - o.left + 3, mid(box(b.e), 'r')[1]];
      pb.setAttribute('d', `M${bs[0]} ${bs[1]} C${bs[0] + 30} ${bs[1] + 90} ${be[0] + 80} ${be[1]} ${be[0]} ${be[1]}`);
      // C: a string between the two disagreeing lines, sagging under its own weight
      const [cs, ce] = [mid(box(c.s), 'r'), mid(box(c.e), 'l')];
      const sag = 46;
      pc.setAttribute('d', `M${cs[0] + 4} ${cs[1]} C${cs[0] + 60} ${cs[1] + sag} ${ce[0] - 60} ${ce[1] + sag} ${ce[0] - 4} ${ce[1]}`);
      const len = pc.getTotalLength();
      if (len && neqRef.current) {
        const m = pc.getPointAtLength(len / 2);
        neqRef.current.style.transform = `translate(${m.x}px, ${m.y}px)`;
      }
    };

    const frame = (t: number) => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      const sway = fine || still ? 0 : Math.sin(t / 2600) * 0.35;
      rig.style.setProperty('--tilt-y', `${((cx + sway) * 7).toFixed(3)}deg`);
      rig.style.setProperty('--tilt-x', `${(-cy * 5).toFixed(3)}deg`);
      threads();
      if (on) raf = requestAnimationFrame(frame);
    };
    // only spend frames while the stage can be seen
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      on = e.isIntersecting;
      if (on) raf = requestAnimationFrame(frame);
    });
    io.observe(scene);
    return () => {
      on = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      if (stage) { stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerleave', leave); }
    };
  }, [still]);

  const on = Array.from({ length: phase }, (_, i) => `on-${i + 1}`).join(' ');
  const step = STEP_OF(phase);

  return (
    <>
      <div ref={sceneRef} className={`scene ${on} ${snap ? 'snap' : ''} ${still ? 'still' : ''}`}
        role="img" aria-label="Animated example from the demo: two sources prove a claim, two others contradict each other and become a question for Aarav, and a reviewer approves the claim for Diya.">
        <div ref={rigRef} className="rig">
          {/* back: the scattered sources */}
          <div className="obj o-notes"><div className="float f1"><div className="sheet notes">
            <div className="s-head"><span>Core meeting notes</span><span>02 Sept</span></div>
            <ol className="lines" start={7}>
              <li><span className="hl" data-a="notes">We decided to host the fest website on Netlify instead of the college server</span>, because the college server went down twice last year.</li>
              <li>The SMS gateway API key expires on 31 Mar 2027.</li>
            </ol>
          </div></div></div>

          <div className="obj o-commit"><div className="float f2"><div className="sheet commit">
            <div className="s-head"><span className="who"><i>M</i>Meera committed</span><span>3d7e9a0</span></div>
            <p><span className="hl" data-a="commit">chore: move fest website deploy to Netlify</span></p>
          </div></div></div>

          <div className="obj o-chat"><div className="float f3"><div className="sheet chat">
            <div className="s-head"><span className="who"><i>A</i>Aarav in #core</span><span>12 Sept</span></div>
            <p><span className="hl red" data-a="chat">we're dropping razorpay for now, UPI QR is enough for this fest</span></p>
          </div></div></div>

          <div className="obj o-pr"><div className="float f4"><div className="sheet pr">
            <div className="s-head"><span className="who"><i className="merged">⇡</i>PR #48 merged</span><span>20 Sept</span></div>
            <p><span className="hl red" data-a="pr">feat: re-enable razorpay webhook for workshop payments</span></p>
          </div></div></div>

          <div className="obj o-question"><div className="question">
            <span className="q-mark">?</span>
            <span><b>Question for Aarav</b>Is razorpay dropped, or back for workshops?</span>
          </div></div>

          {/* front: the claim being proven, then passed on */}
          <div className="obj o-claim"><div className="pass-x"><div className="pass-y"><div className="claim-3d">
            <div className="c-margin">
              <span className="ink i1"><InkMark s="cited" /></span>
              <span className="ink i2"><InkMark s="corroborated" /></span>
            </div>
            <div className="c-body">
              <div className="c-meta"><span className="c-status">Corroborated</span><span className="c-type">Decision</span><span>Fest website</span></div>
              <p className="c-text">We decided to host the fest website on Netlify instead of the college server, because the college server went down twice last year.</p>
              <div className="c-q qa" data-a="slot-a"><q>We decided to host the fest website on Netlify…</q><small>Core meeting notes · line 7</small></div>
              <div className="c-q qb" data-a="slot-b"><q>chore: move fest website deploy to Netlify</q><small>GitHub · commit 3d7e9a0 · Meera</small></div>
              <span className="c-stamp">Approved</span>
            </div>
          </div></div></div></div>

          <div className="obj o-diya"><div className="diya">
            <i>D</i>
            <span><b>Diya</b><span className="d-wait">taking over</span><span className="d-got">handover v1 received</span></span>
          </div></div>
        </div>

        <svg ref={svgRef} className="threads" aria-hidden="true">
          <path className="th th-a" pathLength={1} />
          <path className="th th-b" pathLength={1} />
          <path className="th th-c red" pathLength={1} />
        </svg>
        <div ref={neqRef} className="neq" aria-hidden="true"><span><InkMark s="conflicting" /></span></div>
      </div>

      <ol className="beats" aria-label="What the demo shows">
        <li className={step === 1 ? 'now' : step > 1 ? 'done' : ''}><span>01</span>Verify<small>quotes found word for word</small></li>
        <li className={step === 2 ? 'now' : step > 2 ? 'done' : ''}><span>02</span>Flag<small>sources that disagree</small></li>
        <li className={step === 3 ? 'now' : ''}><span>03</span>Hand over<small>after a human approves</small></li>
      </ol>
    </>
  );
}
