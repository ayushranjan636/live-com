import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

if (!window.matchMedia) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 16) as unknown as number;
  window.cancelAnimationFrame = (id) => clearTimeout(id);
}

// jsdom does not implement SVG geometry; d3-zoom reads svg.viewBox.baseVal / width.baseVal.
const svg = globalThis.SVGSVGElement?.prototype as unknown as object | undefined;
if (svg) {
  Object.defineProperty(svg, "viewBox", { configurable: true, get: () => ({ baseVal: { x: 0, y: 0, width: 1600, height: 800 } }) });
  Object.defineProperty(svg, "width", { configurable: true, get: () => ({ baseVal: { value: 1600 } }) });
  Object.defineProperty(svg, "height", { configurable: true, get: () => ({ baseVal: { value: 800 } }) });
}
const svgEl = globalThis.SVGElement?.prototype as unknown as Record<string, unknown> | undefined;
if (svgEl && !svgEl.getScreenCTM) {
  svgEl.getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) });
}
