import { createContext, useContext, useEffect, useState } from "react";

export const MotionContext = createContext<{ reduced: boolean; setOverride: (v: boolean | null) => void; override: boolean | null }>({
  reduced: false,
  override: null,
  setOverride: () => {},
});

export function useSystemReducedMotion() {
  const q = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const [v, setV] = useState(q?.matches ?? false);
  useEffect(() => {
    if (!q) return;
    const f = () => setV(q.matches);
    q.addEventListener?.("change", f);
    return () => q.removeEventListener?.("change", f);
  }, [q]);
  return v;
}

export const useReducedMotion = () => useContext(MotionContext).reduced;

export function useFullscreen() {
  const [fs, setFs] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const f = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return { fs, toggle };
}

/** requestAnimationFrame-driven playback over [from, to]; stops at `to`. */
export function usePlayback(opts: { from: number; to: number; durationPerUnitMs: number; playing: boolean; onTick: (t: number) => void; onEnd: () => void; t: number }) {
  const { from, to, durationPerUnitMs, playing, onTick, onEnd, t } = opts;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let cur = t >= to ? from : t;
    const step = (now: number) => {
      cur = Math.min(to, cur + (now - last) / durationPerUnitMs);
      last = now;
      onTick(cur);
      if (cur >= to) {
        onEnd();
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, from, to, durationPerUnitMs]);
}
