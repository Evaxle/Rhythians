"use client";

import { useEffect, useRef } from "react";

const TRAVEL = 1500;
const STAGGER = 340;
const HOLD = 450;
const Z_FAR = -9;
const Z_NEAR = 0;
const CAM_Z = 4;
const FOCAL = 380;
const GRID_HALF = 1.5;
const NOTE_HALF = 0.42;
const ACCENT: [number, number, number] = [114, 137, 218];

type CanvasView = {
  width: number;
  height: number;
  center: number;
  scale: number;
};

function project(x: number, y: number, z: number, view: CanvasView) {
  const s = FOCAL / (CAM_Z - z);
  return {
    x: view.center + x * s * view.scale,
    y: view.height / 2 - y * s * view.scale,
    s,
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function drawGrid(ctx: CanvasRenderingContext2D, view: CanvasView) {
  const slices = [0, -2, -4, -6, -8];
  slices.forEach((z, index) => {
    const opacity = 0.05 + (1 - index / slices.length) * 0.16;
    ctx.strokeStyle = `rgba(${ACCENT[0]}, ${ACCENT[1]}, ${ACCENT[2]}, ${opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = -GRID_HALF; gx <= GRID_HALF + 0.001; gx += 1) {
      const p1 = project(gx, -GRID_HALF, z, view);
      const p2 = project(gx, GRID_HALF, z, view);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    }
    for (let gy = -GRID_HALF; gy <= GRID_HALF + 0.001; gy += 1) {
      const p1 = project(-GRID_HALF, gy, z, view);
      const p2 = project(GRID_HALF, gy, z, view);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    }
    ctx.stroke();
  });
}

function drawPath(ctx: CanvasRenderingContext2D, notes: { x: number; y: number }[]) {
  if (notes.length < 2) return;
  ctx.strokeStyle = `rgba(${ACCENT[0]}, ${ACCENT[1]}, ${ACCENT[2]}, 0.35)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  notes.forEach((note, index) => {
    if (index === 0) ctx.moveTo(note.x, note.y);
    else ctx.lineTo(note.x, note.y);
  });
  ctx.stroke();
}

function drawNote(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: [number, number, number],
  opacity: number
) {
  const half = size / 2;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  ctx.strokeStyle = `rgba(255,255,255,${0.35 * opacity})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x - half, y - half, size, size, 4);
  } else {
    ctx.rect(x - half, y - half, size, size);
  }
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function render(
  ctx: CanvasRenderingContext2D,
  view: CanvasView,
  grid: Array<[number, number]>,
  now: number
) {
  ctx.clearRect(0, 0, view.width, view.height);

  const n = grid.length;
  const loop = TRAVEL + STAGGER * (n - 1) + HOLD;

  const active: { x: number; y: number; z: number; opacity: number }[] = [];

  grid.forEach(([col, row], index) => {
    const local = (now - index * STAGGER) % loop;
    if (local < 0 || local > TRAVEL + HOLD) return;

    const x = col - 1;
    const y = 1 - row;
    let z: number;
    let opacity: number;

    if (local <= TRAVEL) {
      const p = local / TRAVEL;
      z = lerp(Z_FAR, Z_NEAR, p);
      opacity = 0.35 + 0.65 * p;
    } else {
      const f = (local - TRAVEL) / HOLD;
      z = Z_NEAR;
      opacity = 1 - f;
    }

    const projected = project(x, y, z, view);
    active.push({ x: projected.x, y: projected.y, z, opacity });
  });

  active.sort((a, b) => a.z - b.z);
  drawPath(ctx, active);
  drawGrid(ctx, view);

  active.forEach((note) => {
    const size = NOTE_HALF * 2 * (FOCAL / (CAM_Z - note.z)) * view.scale;
    drawNote(ctx, note.x, note.y, size, ACCENT, note.opacity);
  });
}

function PatternCanvas({ grid }: { grid: Array<[number, number]> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const view: CanvasView = {
      width,
      height,
      center: width / 2,
      scale: width / 320,
    };

    let frame = 0;
    const start = performance.now() - TRAVEL;

    const tick = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(ctx, view, grid, now - start);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    const onResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0 && (w !== width || h !== height)) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        view.width = w;
        view.height = h;
        view.center = w / 2;
        view.scale = w / 320;
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [grid]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}

export function PatternGrid({
  grid,
  gridName,
}: {
  grid: Array<[number, number]>;
  gridName?: string;
}) {
  return (
    <div className="w-full">
      {gridName ? (
        <p className="mb-3 text-center text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          {gridName}
        </p>
      ) : null}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-background/70 shadow-inner">
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle at center, rgba(114,137,218,0.08), transparent 65%)",
          }}
        />
        <PatternCanvas grid={grid} />
      </div>
    </div>
  );
}
