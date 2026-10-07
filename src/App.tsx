import { useCallback, useEffect, useRef, useState } from "react";
import { marked } from "marked";
import methodologyMd from "../docs/METHODOLOGY.md?raw";
import { CounterPage } from "./pages/CounterPage";
import { MapPage } from "./pages/MapPage";
import { ErakshaPage } from "./pages/ErakshaPage";
import { snapshot } from "./data/snapshot";
import { MotionContext, useFullscreen, useSystemReducedMotion } from "./lib/hooks";

export const PAGES = [
  { id: "counter", label: "Live count", hash: "#/" },
  { id: "map", label: "World map", hash: "#/map" },
  { id: "eraksha", label: "eRaksha", hash: "#/eraksha" },
] as const;
type PageId = (typeof PAGES)[number]["id"];

export const PRESENT_DWELL_MS = { counter: 18000, map: 22000, eraksha: 18000 } as const;
const IDLE_RESUME_MS = 45000;

function pageFromHash(h: string): PageId {
  return (PAGES.find((p) => p.hash === h)?.id ?? (h.startsWith("#/map") ? "map" : h.startsWith("#/eraksha") ? "eraksha" : "counter")) as PageId;
}

export default function App() {
  const [page, setPage] = useState<PageId>(() => pageFromHash(location.hash));
  const [methodOpen, setMethodOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [presentPaused, setPresentPaused] = useState(false);
  const [sharedYear, setSharedYear] = useState<number | null>(null);
  const sys = useSystemReducedMotion();
  const [motionOverride, setMotionOverride] = useState<boolean | null>(null);
  const reduced = motionOverride ?? sys;
  const { fs, toggle: toggleFs } = useFullscreen();
  const datasetId = snapshot.default_dataset_id;

  const presentingRef = useRef(false);
  const go = useCallback((p: PageId) => {
    setPage(p);
    const h = PAGES.find((x) => x.id === p)!.hash;
    if (location.hash !== h) history.replaceState(null, "", h);
  }, []);
  const step = useCallback(
    (d: number) => {
      const i = PAGES.findIndex((p) => p.id === page);
      go(PAGES[(i + d + PAGES.length) % PAGES.length].id);
    },
    [page, go],
  );

  useEffect(() => {
    const f = () => setPage(pageFromHash(location.hash));
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  // Presentation sequence: Worldwide → Map → eRaksha → … Definitions stay on screen.
  useEffect(() => {
    presentingRef.current = presenting;
  }, [presenting]);
  useEffect(() => {
    if (!presenting || presentPaused || methodOpen) return;
    const id = setTimeout(() => step(1), PRESENT_DWELL_MS[page]);
    return () => clearTimeout(id);
  }, [presenting, presentPaused, page, step, methodOpen]);

  // Visitor interaction pauses the sequence; it resumes after a period of inactivity.
  const idleRef = useRef<number>();
  useEffect(() => {
    if (!presenting) return;
    const onAct = (e: Event) => {
      if ((e.target as HTMLElement)?.closest?.("[data-present-control]")) return;
      setPresentPaused(true);
      clearTimeout(idleRef.current);
      idleRef.current = window.setTimeout(() => setPresentPaused(false), IDLE_RESUME_MS);
    };
    window.addEventListener("pointerdown", onAct);
    window.addEventListener("keydown", onAct);
    return () => {
      window.removeEventListener("pointerdown", onAct);
      window.removeEventListener("keydown", onAct);
      clearTimeout(idleRef.current);
    };
  }, [presenting]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape" && methodOpen) return setMethodOpen(false);
      if (methodOpen) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") step(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") step(-1);
      else if (e.key === "1") go("counter");
      else if (e.key === "2") go("map");
      else if (e.key === "3") go("eraksha");
      else if (e.key.toLowerCase() === "f") toggleFs();
      else if (e.key.toLowerCase() === "m") setMethodOpen(true);
      else if (e.key.toLowerCase() === "p") setPresenting((v) => !v);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [step, go, toggleFs, methodOpen]);

  return (
    <MotionContext.Provider value={{ reduced, override: motionOverride, setOverride: setMotionOverride }}>
      <div className={`app ${reduced ? "reduce-motion" : ""}`} data-page={page}>
        <nav className="topnav" aria-label="Sections">
          <span className="brand">eRaksha</span>
          <ol className="pages">
            {PAGES.map((p) => (
              <li key={p.id}>
                <a
                  href={p.hash}
                  aria-current={page === p.id ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    go(p.id);
                  }}
                >
                  {p.label}
                </a>
              </li>
            ))}
          </ol>
          <div className="nav-actions" data-present-control>
            <button className="btn ghost" onClick={() => setMethodOpen(true)} aria-haspopup="dialog">
              Methodology
            </button>
            <button className={`btn ghost ${presenting ? "on" : ""}`} onClick={() => { setPresenting((v) => !v); setPresentPaused(false); }} aria-pressed={presenting}>
              {presenting ? (presentPaused ? "Presenting · paused" : "Presenting") : "Present"}
            </button>
            <button className="btn ghost" onClick={toggleFs} aria-pressed={fs}>
              {fs ? "Exit full screen" : "Full screen"}
            </button>
            <button className="btn ghost" onClick={() => setMotionOverride(reduced ? false : true)} aria-pressed={reduced} title="Reduce motion">
              {reduced ? "Motion: reduced" : "Motion: on"}
            </button>
          </div>
        </nav>

        <main key={page} className="page-host">
          {page === "counter" && <CounterPage datasetId={datasetId} onOpenMethod={() => setMethodOpen(true)} />}
          {page === "map" && (
            <MapPage datasetId={datasetId} sharedYear={sharedYear} onYearChange={setSharedYear} onOpenMethod={() => setMethodOpen(true)} />
          )}
          {page === "eraksha" && <ErakshaPage onOpenMethod={() => setMethodOpen(true)} />}
        </main>

        <footer className="snapshot-footer">
          Data snapshot {snapshot.snapshot_date} · bundled offline copy · NCMEC and WHO do not endorse eRaksha
        </footer>

        {methodOpen && <MethodologyDrawer onClose={() => setMethodOpen(false)} />}
      </div>
    </MotionContext.Provider>
  );
}

function MethodologyDrawer({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Methodology" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>        <article className="prose" dangerouslySetInnerHTML={{ __html: marked.parse(methodologyMd, { async: false }) as string }} />
      </aside>
    </div>
  );
}
