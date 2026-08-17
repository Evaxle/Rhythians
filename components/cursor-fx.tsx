"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "rhythians_cursor_prefs";
const PREFS_EVENT = "rhythians:cursor-prefs";
const TRAIL_LENGTH = 10;

type Prefs = { enabled: boolean; trail: boolean };

const defaultPrefs: Prefs = { enabled: false, trail: true };

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return defaultPrefs;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      enabled: Boolean(parsed.enabled),
      trail: parsed.trail !== false,
    };
  } catch {
    return defaultPrefs;
  }
}

export function CursorFX() {
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);

  useEffect(() => {
    const initial = loadPrefs();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(initial);

    const onPrefs = (event: Event) => {
      const detail = (event as CustomEvent<Prefs>).detail;
      if (detail) setPrefs(detail);
    };
    window.addEventListener(PREFS_EVENT, onPrefs);
    window.addEventListener("storage", onPrefs);
    return () => {
      window.removeEventListener(PREFS_EVENT, onPrefs);
      window.removeEventListener("storage", onPrefs);
    };
  }, []);

  useEffect(() => {
    const enabled = prefs.enabled;
    const trail = prefs.trail;
    if (!enabled || !window.matchMedia("(pointer: fine)").matches) {
      document.documentElement.classList.remove("cursor-fx-active");
      return;
    }

    document.documentElement.classList.add("cursor-fx-active");

    const dot = document.createElement("div");
    dot.className = "cursor-fx-dot";

    const ring = document.createElement("div");
    ring.className = "cursor-fx-ring";

    const trailEls: HTMLDivElement[] = [];
    if (trail) {
      for (let i = 0; i < TRAIL_LENGTH; i++) {
        const el = document.createElement("div");
        const size = Math.max(4, 11 - i * 0.8);
        const opacity = Math.max(0.08, 0.55 - i * 0.05);
        el.className = "cursor-fx-trail";
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.opacity = String(opacity);
        trailEls.push(el);
      }
    }

    document.body.appendChild(dot);
    document.body.appendChild(ring);
    trailEls.forEach((el) => document.body.appendChild(el));

    const positions = trailEls.map(() => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 }));

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let raf = 0;
    let active = true;

    const onMove = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const tick = () => {
      if (!active) return;
      const dotSize = dot.offsetWidth || 8;
      const ringSize = ring.offsetWidth || 34;

      dot.style.transform = `translate3d(${mouseX - dotSize / 2}px, ${mouseY - dotSize / 2}px, 0)`;

      ringX += (mouseX - ringX) * 0.2;
      ringY += (mouseY - ringY) * 0.2;
      ring.style.transform = `translate3d(${ringX - ringSize / 2}px, ${ringY - ringSize / 2}px, 0)`;

      let prevX = mouseX;
      let prevY = mouseY;
      for (let i = 0; i < trailEls.length; i++) {
        const pos = positions[i];
        pos.x = prevX + (pos.x - prevX) * 0.35;
        pos.y = prevY + (pos.y - prevY) * 0.35;
        const el = trailEls[i];
        const size = el.offsetWidth || 6;
        el.style.transform = `translate3d(${pos.x - size / 2}px, ${pos.y - size / 2}px, 0)`;
        prevX = pos.x;
        prevY = pos.y;
      }

      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      dot.remove();
      ring.remove();
      trailEls.forEach((el) => el.remove());
      document.documentElement.classList.remove("cursor-fx-active");
    };
  }, [prefs]);

  return null;
}