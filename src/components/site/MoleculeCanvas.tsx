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

export function MoleculeCanvas({ className = "", density = 1 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, raf = 0, visible = true;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const makers = [benzene, water, methane, co2, so4, benzene, water];
    let mols: Molecule[] = [];
    let dust: { x: number; y: number; z: number; s: number }[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w < 700 ? 5 : 8) * density);
      mols = Array.from({ length: count }, (_, i) => ({
        ...makers[i % makers.length](),
        pos: [rnd(0.05, 0.95) * w, rnd(0.08, 0.92) * h, rnd(0.4, 1.4)],
        rot: [rnd(0, 6), rnd(0, 6), rnd(0, 6)],
        spin: [rnd(-0.004, 0.004), rnd(-0.006, 0.006), rnd(-0.003, 0.003)],
        scale: rnd(w < 700 ? 9 : 12, w < 700 ? 16 : 24),
      }));
      dust = Array.from({ length: w < 700 ? 40 : 90 }, () => ({ x: Math.random() * w, y: Math.random() * h, z: rnd(0.2, 1), s: rnd(0.4, 1.6) }));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      for (const d of dust) {
        d.y -= 0.15 * d.z;
        if (d.y < -5) { d.y = h + 5; d.x = Math.random() * w; }
        const a = 0.25 + 0.35 * Math.sin(t / 900 + d.x);
        ctx.fillStyle = `rgba(165,180,252,${a * d.z})`;
        ctx.beginPath();
        ctx.arc(d.x + mouse.x * 12 * d.z, d.y + mouse.y * 12 * d.z, d.s, 0, Math.PI * 2);
        ctx.fill();
      }
      const sorted = [...mols].sort((a, b) => a.pos[2] - b.pos[2]);
      for (const m of sorted) {
        m.rot = [m.rot[0] + m.spin[0], m.rot[1] + m.spin[1], m.rot[2] + m.spin[2]];
        const depth = m.pos[2];
        const cx = m.pos[0] + mouse.x * 40 * depth;
        const cy = m.pos[1] + mouse.y * 30 * depth + Math.sin(t / 2400 + m.pos[0]) * 10;
        const k = m.scale * depth;
        const pts = m.atoms.map((a) => {
          const [x, y, z] = rotate(a.p, m.rot);
          const persp = 6 / (6 + z);
          return { x: cx + x * k * persp, y: cy + y * k * persp, z, r: a.r * k * persp, c: a.c };
        });
        ctx.globalAlpha = Math.min(1, 0.25 + depth * 0.5);
        ctx.lineWidth = Math.max(1, k * 0.12);
        for (const [i, j] of m.bonds) {
          const g = ctx.createLinearGradient(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
          g.addColorStop(0, pts[i].c + "aa");
          g.addColorStop(1, pts[j].c + "aa");
          ctx.strokeStyle = g;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
        for (const p of [...pts].sort((a, b) => a.z - b.z)) {
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
          glow.addColorStop(0, p.c + "55");
          glow.addColorStop(1, p.c + "00");
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2); ctx.fill();
          const g = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.1, p.x, p.y, p.r);
          g.addColorStop(0, "#ffffff");
          g.addColorStop(0.35, p.c);
          g.addColorStop(1, "#1e1b4b");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };

    const loop = (t: number) => {
      if (visible) draw(t);
      raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / window.innerWidth - 0.5;
      mouse.ty = e.clientY / window.innerHeight - 0.5;
    };
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [density]);

  return <canvas ref={ref} className={`pointer-events-none h-full w-full ${className}`} aria-hidden />;
}
