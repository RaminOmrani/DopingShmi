"use client";
import { useEffect, useRef } from "react";

type V3 = [number, number, number];
interface Molecule {
  atoms: { p: V3; r: number; c: string }[];
  bonds: [number, number][];
  pos: V3;
  rot: V3;
  spin: V3;
  scale: number;
}

const C = { C: "#67e8f9", O: "#f0abfc", H: "#e0e7ff", N: "#a78bfa", S: "#fde047" };

function benzene(): Pick<Molecule, "atoms" | "bonds"> {
  const atoms: Molecule["atoms"] = [];
  const bonds: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    atoms.push({ p: [Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0], r: 0.42, c: C.C });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    atoms.push({ p: [Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0], r: 0.26, c: C.H });
    bonds.push([i, (i + 1) % 6], [i, i + 6]);
  }
  return { atoms, bonds };
}
function water(): Pick<Molecule, "atoms" | "bonds"> {
  return { atoms: [{ p: [0, 0, 0], r: 0.6, c: C.O }, { p: [0.95, 0.75, 0], r: 0.32, c: C.H }, { p: [-0.95, 0.75, 0], r: 0.32, c: C.H }], bonds: [[0, 1], [0, 2]] };
}
function methane(): Pick<Molecule, "atoms" | "bonds"> {
  const t = 1.2;
  return {
    atoms: [{ p: [0, 0, 0], r: 0.55, c: C.N }, { p: [t, t, t], r: 0.3, c: C.H }, { p: [-t, -t, t], r: 0.3, c: C.H }, { p: [-t, t, -t], r: 0.3, c: C.H }, { p: [t, -t, -t], r: 0.3, c: C.H }],
    bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
  };
}
function co2(): Pick<Molecule, "atoms" | "bonds"> {
  return { atoms: [{ p: [0, 0, 0], r: 0.5, c: C.C }, { p: [1.6, 0, 0], r: 0.55, c: C.O }, { p: [-1.6, 0, 0], r: 0.55, c: C.O }], bonds: [[0, 1], [0, 2]] };
}
function so4(): Pick<Molecule, "atoms" | "bonds"> {
  const t = 1.3;
  return {
    atoms: [{ p: [0, 0, 0], r: 0.6, c: C.S }, { p: [t, t, t], r: 0.45, c: C.O }, { p: [-t, -t, t], r: 0.45, c: C.O }, { p: [-t, t, -t], r: 0.45, c: C.O }, { p: [t, -t, -t], r: 0.45, c: C.O }],
    bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
  };
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function rotate([x, y, z]: V3, [ax, ay, az]: V3): V3 {
  let c = Math.cos(ax), s = Math.sin(ax);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ay); s = Math.sin(ay);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(az); s = Math.sin(az);
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}

/** اسپرایت کره‌ی هر رنگ اتم: یک بار رسم می‌شود و هر فریم فقط drawImage (به‌جای دو گرادیان شعاعی برای هر اتم در هر فریم) */
const SPRITE_R = 32;
function atomSprite(color: string): HTMLCanvasElement {
  const size = SPRITE_R * 6; // هاله تا سه برابر شعاع
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const m = size / 2;
  const glow = g.createRadialGradient(m, m, 0, m, m, SPRITE_R * 3);
  glow.addColorStop(0, color + "55");
  glow.addColorStop(1, color + "00");
  g.fillStyle = glow;
  g.beginPath(); g.arc(m, m, SPRITE_R * 3, 0, Math.PI * 2); g.fill();
  const s = g.createRadialGradient(m - SPRITE_R * 0.35, m - SPRITE_R * 0.35, SPRITE_R * 0.1, m, m, SPRITE_R);
  s.addColorStop(0, "#ffffff");
  s.addColorStop(0.35, color);
  s.addColorStop(1, "#1e1b4b");
  g.fillStyle = s;
  g.beginPath(); g.arc(m, m, SPRITE_R, 0, Math.PI * 2); g.fill();
  return c;
}

type Nav = Navigator & { connection?: { saveData?: boolean } };

/**
 * پس‌زمینه‌ی مولکول‌های سه‌بعدی (تزئینی). برای سبک ماندن صفحه:
 * - بعد از load و در زمان بیکاری مرورگر شروع می‌شود (روی LCP و TBT اثر نمی‌گذارد)؛
 * - وقتی دیده نمی‌شود (IntersectionObserver) حلقه‌ی requestAnimationFrame کاملاً متوقف می‌شود؛
 * - در صفحه‌ی باریک، Save-Data یا پردازنده‌ی ضعیف: ۳۰ فریم و مولکول کمتر؛ کاهش حرکت: فقط یک فریم ثابت.
 * در هر صفحه فقط یک نمونه بگذارید.
 */
export function MoleculeCanvas({ className = "", density = 1 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = !!(navigator as Nav).connection?.saveData;
    let w = 0, h = 0, raf = 0, visible = false, started = false, last = 0, frameMs = 1000 / 60;
    let disposed = false;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const makers = [benzene, water, methane, co2, so4, benzene, water];
    const sprites = new Map<string, HTMLCanvasElement>();
    const sprite = (c: string) => sprites.get(c) ?? (sprites.set(c, atomSprite(c)), sprites.get(c)!);
    let mols: Molecule[] = [];
    let dust: { x: number; y: number; z: number; s: number }[] = [];

    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      const narrow = w < 700;
      const dpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 2);
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const low = narrow || saveData || (navigator.hardwareConcurrency || 8) <= 4;
      frameMs = 1000 / (low ? 30 : 60);
      const count = Math.max(2, Math.round((narrow ? 4 : 8) * density * (saveData ? 0.6 : 1)));
      mols = Array.from({ length: count }, (_, i) => ({
        ...makers[i % makers.length](),
        pos: [rnd(0.05, 0.95) * w, rnd(0.08, 0.92) * h, rnd(0.4, 1.4)],
        rot: [rnd(0, 6), rnd(0, 6), rnd(0, 6)],
        spin: [rnd(-0.004, 0.004), rnd(-0.006, 0.006), rnd(-0.003, 0.003)],
        scale: rnd(narrow ? 9 : 12, narrow ? 16 : 24),
      }));
      dust = Array.from({ length: narrow || saveData ? 24 : 90 }, () => ({ x: Math.random() * w, y: Math.random() * h, z: rnd(0.2, 1), s: rnd(0.4, 1.6) }));
    };

    /** k: ضریب زمان نسبت به ۶۰ فریم (در ۳۰ فریم، ۲) تا سرعت حرکت به نرخ فریم وابسته نباشد */
    const draw = (t: number, k: number) => {
      ctx.clearRect(0, 0, w, h);
      mouse.x += (mouse.tx - mouse.x) * 0.05 * k;
      mouse.y += (mouse.ty - mouse.y) * 0.05 * k;
      for (const d of dust) {
        d.y -= 0.15 * d.z * k;
        if (d.y < -5) { d.y = h + 5; d.x = Math.random() * w; }
        const a = 0.25 + 0.35 * Math.sin(t / 900 + d.x);
        ctx.fillStyle = `rgba(165,180,252,${a * d.z})`;
        ctx.beginPath();
        ctx.arc(d.x + mouse.x * 12 * d.z, d.y + mouse.y * 12 * d.z, d.s, 0, Math.PI * 2);
        ctx.fill();
      }
      mols.sort((a, b) => a.pos[2] - b.pos[2]);
      for (const m of mols) {
        m.rot = [m.rot[0] + m.spin[0] * k, m.rot[1] + m.spin[1] * k, m.rot[2] + m.spin[2] * k];
        const depth = m.pos[2];
        const cx = m.pos[0] + mouse.x * 40 * depth;
        const cy = m.pos[1] + mouse.y * 30 * depth + Math.sin(t / 2400 + m.pos[0]) * 10;
        const sc = m.scale * depth;
        const pts = m.atoms.map((a) => {
          const [x, y, z] = rotate(a.p, m.rot);
          const persp = 6 / (6 + z);
          return { x: cx + x * sc * persp, y: cy + y * sc * persp, z, r: a.r * sc * persp, c: a.c };
        });
        ctx.globalAlpha = Math.min(1, 0.25 + depth * 0.5);
        ctx.lineWidth = Math.max(1, sc * 0.12);
        for (const [i, j] of m.bonds) {
          ctx.strokeStyle = pts[i].c + "aa";
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
        pts.sort((a, b) => a.z - b.z);
        for (const p of pts) ctx.drawImage(sprite(p.c), p.x - p.r * 3, p.y - p.r * 3, p.r * 6, p.r * 6);
        ctx.globalAlpha = 1;
      }
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = t - last;
      if (dt < frameMs - 2) return;
      last = t;
      draw(t, Math.min(dt, 100) / (1000 / 60));
    };
    const play = () => {
      if (!started || disposed || raf || reduce || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const pause = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / window.innerWidth - 0.5;
      mouse.ty = e.clientY / window.innerHeight - 0.5;
    };
    let resizeRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resize();
        if (reduce) draw(0, 1);
      });
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) play();
      else pause();
    });

    // شروع بعد از load و در زمان بیکاری؛ تا آن موقع بوم خالی است (تزئینی است)
    const start = () => {
      if (disposed) return;
      started = true;
      resize();
      draw(performance.now(), 1);
      io.observe(canvas);
      window.addEventListener("resize", onResize);
      if (!reduce) window.addEventListener("pointermove", onMove, { passive: true });
    };
    type IdleWin = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const win = window as IdleWin;
    let idleId = 0;
    let timer = 0;
    const whenIdle = () => {
      if (win.requestIdleCallback) idleId = win.requestIdleCallback(start, { timeout: 2000 });
      else timer = window.setTimeout(start, 300);
    };
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });

    return () => {
      disposed = true;
      pause();
      cancelAnimationFrame(resizeRaf);
      if (idleId) win.cancelIdleCallback?.(idleId);
      clearTimeout(timer);
      io.disconnect();
      window.removeEventListener("load", whenIdle);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [density]);

  return <canvas ref={ref} className={`pointer-events-none h-full w-full ${className}`} aria-hidden />;
}
