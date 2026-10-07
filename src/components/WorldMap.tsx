import { useEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, geoPath, geoCentroid } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import topo from "../generated/world.topo.json";
import { useReducedMotion } from "../lib/hooks";

export interface GeoProps {
  fid: string;
  name: string;
  join_iso3: string | null;
  type: string;
}
export type CountryFeature = Feature<Geometry, GeoProps>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fc = feature(topo as any, (topo as any).objects.in) as unknown as { features: CountryFeature[] };
export const COUNTRY_FEATURES: CountryFeature[] = fc.features.filter((f) => f.properties.fid !== "ATA");
export const GEO_METADATA = (topo as unknown as { metadata: Record<string, unknown> }).metadata;

const W = 1600;
const H = 800;

export interface MapStyle {
  fill: string;
  pattern?: "missing" | "planned" | "scenario";
  stroke?: string;
}

interface Props {
  styleFor: (f: CountryFeature) => MapStyle;
  label: string;
  selected: string | null;
  onSelect: (fid: string | null) => void;
  onHover?: (fid: string | null, pos: { x: number; y: number } | null) => void;
  bubbles?: { fid: string; r: number; color: string }[];
  focusFids?: string[] | null; // zoom target
  focusKey?: number;
}

export function WorldMap({ styleFor, label, selected, onSelect, onHover, bubbles, focusFids, focusKey }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>();
  const reduced = useReducedMotion();
  const [k, setK] = useState(1);

  const { path, projection } = useMemo(() => {
    const projection = geoEqualEarth().fitExtent(
      [
        [10, 10],
        [W - 10, H - 10],
      ],
      { type: "FeatureCollection", features: COUNTRY_FEATURES } as never,
    );
    return { path: geoPath(projection), projection };
  }, []);

  const paths = useMemo(() => COUNTRY_FEATURES.map((f) => ({ f, d: path(f) ?? "" })), [path]);
  const centroids = useMemo(() => new Map(COUNTRY_FEATURES.map((f) => [f.properties.fid, projection(geoCentroid(f)) ?? [0, 0]])), [projection]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 24])
      .translateExtent([
        [0, 0],
        [W, H],
      ])
      .on("zoom", (e) => {
        gRef.current?.setAttribute("transform", e.transform.toString());
        setK(e.transform.k);
      });
    zoomRef.current = z;
    select(svgRef.current).call(z).on("dblclick.zoom", null);
  }, []);

  const zoomTo = (fids: string[] | null) => {
    if (!svgRef.current || !zoomRef.current) return;
    const sel = select(svgRef.current);
    const tr = reduced ? sel : (sel.transition().duration(700) as unknown as typeof sel);
    if (!fids || fids.length === 0) {
      tr.call(zoomRef.current.transform, zoomIdentity);
      return;
    }
    const feats = COUNTRY_FEATURES.filter((f) => fids.includes(f.properties.fid));
    const [[x0, y0], [x1, y1]] = path.bounds({ type: "FeatureCollection", features: feats } as never);
    const scale = Math.min(20, 0.85 / Math.max((x1 - x0) / W, (y1 - y0) / H));
    const t = zoomIdentity.translate(W / 2, H / 2).scale(scale).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    tr.call(zoomRef.current.transform, t);
  };

  useEffect(() => {
    if (focusFids !== undefined) zoomTo(focusFids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const zoomBy = (f: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    const sel = select(svgRef.current);
    (reduced ? sel : (sel.transition().duration(250) as unknown as typeof sel)).call(zoomRef.current.scaleBy, f);
  };

  const pos = (e: React.PointerEvent | React.FocusEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    if ("clientX" in e) return { x: e.clientX - r.left, y: e.clientY - r.top };
    const t = (e.target as SVGGraphicsElement).getBoundingClientRect();
    return { x: t.left + t.width / 2 - r.left, y: t.top - r.top };
  };

  return (
    <div className="map-wrap">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="world-map" role="group" aria-label={label} preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="hatch-missing" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#eceef1" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#cfd3da" strokeWidth="2" />
          </pattern>
          <pattern id="hatch-planned" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="#fdf6ec" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="#96560f" strokeWidth="2.6" />
          </pattern>
          <pattern id="dots-scenario" patternUnits="userSpaceOnUse" width="7" height="7">
            <rect width="7" height="7" fill="#fdf6ec" />
            <circle cx="3.5" cy="3.5" r="1.5" fill="#96560f" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="transparent" onClick={() => onSelect(null)} />
        <g ref={gRef}>
          {paths.map(({ f, d }) => {
            const s = styleFor(f);
            const isSel = selected === f.properties.fid;
            const fill = s.pattern === "missing" ? "url(#hatch-missing)" : s.pattern === "planned" ? "url(#hatch-planned)" : s.pattern === "scenario" ? "url(#dots-scenario)" : s.fill;
            return (
              <path
                key={f.properties.fid}
                d={d}
                fill={fill}
                stroke={isSel ? "#16181d" : s.stroke ?? "#ffffff"}
                strokeWidth={(isSel ? 1.8 : 0.5) / k}
                vectorEffect="non-scaling-stroke"
                className="country"
                data-fid={f.properties.fid}
                tabIndex={-1}
                onPointerEnter={(e) => e.pointerType === "mouse" && onHover?.(f.properties.fid, pos(e))}
                onPointerMove={(e) => e.pointerType === "mouse" && onHover?.(f.properties.fid, pos(e))}
                onPointerLeave={() => onHover?.(null, null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(f.properties.fid === selected ? null : f.properties.fid);
                }}
              />
            );
          })}
          {bubbles?.map((b) => {
            const c = centroids.get(b.fid);
            if (!c) return null;
            return <circle key={b.fid} cx={c[0]} cy={c[1]} r={b.r / Math.sqrt(k)} fill={b.color} fillOpacity={0.7} stroke="#fff" strokeOpacity={0.9} strokeWidth={1 / k} pointerEvents="none" />;
          })}
        </g>
      </svg>
      <div className="zoom-controls" aria-label="Map zoom">
        <button className="btn icon" onClick={() => zoomBy(1.6)} aria-label="Zoom in">+</button>
        <button className="btn icon" onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out">−</button>
        {k > 1.01 && (
          <button className="btn zoom-reset" onClick={() => zoomTo(null)} aria-label="Reset map view">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

export function featureByIso(iso: string) {
  return COUNTRY_FEATURES.find((f) => f.properties.join_iso3 === iso) ?? null;
}
