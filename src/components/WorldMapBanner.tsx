"use client";

import { useState, useRef, useCallback, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface NationStat {
  name: string;
  gdp_growth: number;
  inflation: number;
  color: string;
}

interface WorldMapBannerProps {
  nationStats?: NationStat[];
}

const NATION_MAP: Record<
  string,
  { name: string; flag: string; defaultColor: string }
> = {
  "356": { name: "Bharat", flag: "\u{1F1EE}\u{1F1F3}", defaultColor: "#2E75B6" },
  "392": { name: "Nihon", flag: "\u{1F1EF}\u{1F1F5}", defaultColor: "#E8792F" },
  "826": { name: "Avalon", flag: "\u{1F3F4}", defaultColor: "#2E8B57" },
  "276": { name: "Eldoria", flag: "\u{1F3DB}\uFE0F", defaultColor: "#8E44AD" },
  "554": { name: "Zephyr", flag: "\u{1F30A}", defaultColor: "#16A085" },
};

const ACTIVE_ISO_CODES = new Set(Object.keys(NATION_MAP));

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;

function WorldMapBanner({ nationStats = [] }: WorldMapBannerProps) {
  const [hoveredNation, setHoveredNation] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Pan & zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan on left click
    if (e.button !== 0) return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    if (containerRef.current) containerRef.current.style.cursor = "grabbing";
  }, []);

  const onMouseUp = useCallback(() => {
    isPanning.current = false;
    if (containerRef.current) containerRef.current.style.cursor = "grab";
  }, []);

  const onMouseMovePan = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning.current) return;
      e.preventDefault();
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    },
    []
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoom((prev) => {
      const next = e.deltaY < 0 ? prev + ZOOM_STEP : prev - ZOOM_STEP;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev + 0.4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_ZOOM, prev - 0.4));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const getColor = (isoCode: string) => {
    const nation = NATION_MAP[isoCode];
    if (!nation) return "#E8E6E1";
    const stat = nationStats.find((s) => s.name === nation.name);
    return stat?.color ?? nation.defaultColor;
  };

  const hoveredData = hoveredNation ? NATION_MAP[hoveredNation] : null;
  const hoveredStat = hoveredData
    ? nationStats.find((s) => s.name === hoveredData.name)
    : null;

  const zoomPct = Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100);

  return (
    <div className="relative w-full rounded-xl border border-gray-100 bg-[#FAFAF8] shadow-sm overflow-hidden">
      {/* Grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <style jsx>{`
        @keyframes nation-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .nation-active {
          animation: nation-pulse 3s ease-in-out infinite;
        }
        .nation-active:hover {
          animation: none;
          opacity: 1;
        }
      `}</style>

      {/* Pannable + zoomable map area */}
      <div
        ref={containerRef}
        className="cursor-grab select-none overflow-hidden"
        style={{ height: 320 }}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseMove={onMouseMovePan}
        onWheel={onWheel}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isPanning.current ? "none" : "transform 0.15s ease-out",
            width: "100%",
            height: "100%",
          }}
        >
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 150, center: [40, 25] }}
            width={960}
            height={320}
            style={{ width: "100%", height: "100%" }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const isoCode = String(geo.id);
                  const isActive = ACTIVE_ISO_CODES.has(isoCode);
                  const fillColor = getColor(isoCode);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      className={isActive ? "nation-active" : ""}
                      onMouseEnter={(e) => {
                        if (isActive && !isPanning.current) {
                          setHoveredNation(isoCode);
                          setTooltipPos({ x: e.clientX, y: e.clientY });
                        }
                      }}
                      onMouseMove={(e) => {
                        if (isActive && !isPanning.current) {
                          setTooltipPos({ x: e.clientX, y: e.clientY });
                        }
                      }}
                      onMouseLeave={() => {
                        if (isActive) setHoveredNation(null);
                      }}
                      style={{
                        default: {
                          fill: fillColor,
                          stroke: isActive ? "#FFFFFF" : "#D9D6D0",
                          strokeWidth: isActive ? 0.8 : 0.25,
                          cursor: isActive ? "pointer" : "inherit",
                          outline: "none",
                        },
                        hover: {
                          fill: isActive ? fillColor : "#E8E6E1",
                          stroke: isActive ? "#FFFFFF" : "#D9D6D0",
                          strokeWidth: isActive ? 1.2 : 0.25,
                          filter: isActive
                            ? "brightness(1.15) drop-shadow(0 0 4px rgba(0,0,0,0.2))"
                            : "none",
                          cursor: isActive ? "pointer" : "inherit",
                          outline: "none",
                        },
                        pressed: { fill: fillColor, outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        </div>
      </div>

      {/* Zoom controls — bottom-right */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5">
        <button
          onClick={handleZoomOut}
          className="w-7 h-7 rounded-lg bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-white transition-colors text-sm font-bold"
          title="Zoom out"
        >
          -
        </button>
        <div className="w-16 h-1.5 rounded-full bg-gray-200 relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[#E8792F]/60 transition-all duration-150"
            style={{ width: `${zoomPct}%` }}
          />
        </div>
        <button
          onClick={handleZoomIn}
          className="w-7 h-7 rounded-lg bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-white transition-colors text-sm font-bold"
          title="Zoom in"
        >
          +
        </button>
        {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
          <button
            onClick={handleReset}
            className="ml-1 h-7 px-2 rounded-lg bg-white/90 border border-gray-200 shadow-sm text-[10px] font-medium text-gray-400 hover:text-gray-700 hover:bg-white transition-colors tracking-wide"
            title="Reset view"
          >
            RESET
          </button>
        )}
      </div>

      {/* Bottom-left hint */}
      <div className="absolute bottom-3 left-3 z-20 text-[10px] text-gray-300 font-mono tracking-wider">
        SCROLL TO ZOOM · DRAG TO PAN
      </div>

      {/* Tooltip */}
      {hoveredData && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
          style={{
            left: tooltipPos.x + 14,
            top: tooltipPos.y - 10,
            transform: "translateY(-100%)",
          }}
        >
          <div className="flex items-center gap-2 border-b border-gray-100 pb-1.5 mb-1.5">
            <span className="text-lg">{hoveredData.flag}</span>
            <span className="text-sm font-bold text-[#1B2A4A] font-[family-name:var(--font-dm-sans)]">
              {hoveredData.name}
            </span>
          </div>
          {hoveredStat ? (
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">GDP Growth</span>
                <span className={hoveredStat.gdp_growth >= 0 ? "text-green-600" : "text-red-600"}>
                  {hoveredStat.gdp_growth >= 0 ? "+" : ""}
                  {hoveredStat.gdp_growth.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Inflation</span>
                <span className="text-gray-700">{hoveredStat.inflation.toFixed(1)}%</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No data yet</p>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(WorldMapBanner);
