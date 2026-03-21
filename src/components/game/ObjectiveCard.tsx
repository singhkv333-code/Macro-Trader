"use client";

// ObjectiveCard — tells the player exactly what good looks like.
// Shows current position vs target zone for each scoring metric.

interface CountryProfile {
  rNeutral: number;
}

interface ObjectiveCardProps {
  country: CountryProfile;
  currentMetrics: {
    gdpGrowth: number;
    inflation: number;
    deficit: number;
    fxStability: number;   // 0–1 (1 = perfectly stable)
    diplomacyScore: number; // 0–100
  };
}

type Zone = "excellent" | "good" | "warning" | "critical";

interface Objective {
  label: string;
  hint: string;
  target: string;
  current: number;
  format: (v: number) => string;
  getZone: (v: number) => Zone;
  tip: string;
  // For MiniZoneBar: defines where zone boundaries sit on a 0–1 normalized axis
  barConfig: BarConfig;
}

// ── MiniZoneBar ──────────────────────────────────────────────────────────────

interface BarSegment {
  zone: Zone;
  widthPct: number; // % of total bar width
}

interface BarConfig {
  segments: BarSegment[];
  // maps raw value → 0–1 position on bar
  toPosition: (v: number) => number;
}

const ZONE_COLORS: Record<Zone, { bg: string; fill: string }> = {
  excellent: { bg: "bg-emerald-200", fill: "bg-emerald-500" },
  good:      { bg: "bg-green-200",   fill: "bg-green-500"   },
  warning:   { bg: "bg-amber-200",   fill: "bg-amber-500"   },
  critical:  { bg: "bg-red-200",     fill: "bg-red-500"     },
};

const ZONE_TEXT: Record<Zone, string> = {
  excellent: "text-emerald-700 bg-emerald-50",
  good:      "text-green-700   bg-green-50",
  warning:   "text-amber-700   bg-amber-50",
  critical:  "text-red-700     bg-red-50",
};

function MiniZoneBar({ value, barConfig }: { value: number; barConfig: BarConfig }) {
  const pos = Math.max(0, Math.min(1, barConfig.toPosition(value)));

  return (
    <div className="relative mt-1.5 mb-0.5">
      {/* Colored zone segments */}
      <div className="flex h-2 rounded-full overflow-hidden">
        {barConfig.segments.map((seg, i) => (
          <div
            key={i}
            className={`${ZONE_COLORS[seg.zone].bg} h-full`}
            style={{ width: `${seg.widthPct}%` }}
          />
        ))}
      </div>

      {/* Current-value marker (small triangle) */}
      <div
        className="absolute -top-0.5 w-2 h-3 flex flex-col items-center"
        style={{ left: `calc(${pos * 100}% - 4px)` }}
      >
        <div className="w-0 h-0" style={{
          borderLeft: "4px solid transparent",
          borderRight: "4px solid transparent",
          borderTop: "5px solid #1A1A1A",
        }} />
      </div>
    </div>
  );
}

// ── Bar configs per metric ────────────────────────────────────────────────────

// GDP Growth: domain –4 to +12  (16-pt range)
// Zones: critical(<0), warning(0-3), good(3-6), excellent(6+, capped 12)
const gdpBarConfig: BarConfig = {
  segments: [
    { zone: "critical", widthPct: 25 },   // –4 to 0
    { zone: "warning",  widthPct: 18.75 },// 0 to 3
    { zone: "good",     widthPct: 18.75 },// 3 to 6
    { zone: "excellent",widthPct: 37.5 }, // 6 to 12
  ],
  toPosition: (v) => (Math.min(Math.max(v, -4), 12) + 4) / 16,
};

// Inflation: domain –2 to 18  (20-pt range)
// Zones: warning(<0), warning(0-2), excellent(2-4), warning(4-7), critical(7-12), critical(12+)
const inflBarConfig: BarConfig = {
  segments: [
    { zone: "critical", widthPct: 10  }, // –2 to 0
    { zone: "warning",  widthPct: 10  }, // 0 to 2
    { zone: "excellent",widthPct: 10  }, // 2 to 4  ← sweet spot
    { zone: "warning",  widthPct: 15  }, // 4 to 7
    { zone: "critical", widthPct: 25  }, // 7 to 12
    { zone: "critical", widthPct: 30  }, // 12 to 18
  ],
  toPosition: (v) => (Math.min(Math.max(v, -2), 18) + 2) / 20,
};

// Budget Deficit: domain –2 (surplus) to 12  (14-pt range)
// Zones: excellent(<0), good(0-3), warning(3-6), critical(6+)
const deficitBarConfig: BarConfig = {
  segments: [
    { zone: "excellent", widthPct: 14.3 }, // –2 to 0
    { zone: "good",      widthPct: 21.4 }, // 0 to 3
    { zone: "warning",   widthPct: 21.4 }, // 3 to 6
    { zone: "critical",  widthPct: 42.9 }, // 6 to 12
  ],
  toPosition: (v) => (Math.min(Math.max(v, -2), 12) + 2) / 14,
};

// FX Stability: domain 0 to 1  (already normalised)
// Zones: critical(0-0.4), warning(0.4-0.7), good(0.7-1)
const fxBarConfig: BarConfig = {
  segments: [
    { zone: "critical", widthPct: 40 }, // 0 to 0.4
    { zone: "warning",  widthPct: 30 }, // 0.4 to 0.7
    { zone: "good",     widthPct: 30 }, // 0.7 to 1
  ],
  toPosition: (v) => Math.min(Math.max(v, 0), 1),
};

// Diplomacy: domain 0 to 100
// Zones: critical(0-30), warning(30-60), good(60-100)
const diplomacyBarConfig: BarConfig = {
  segments: [
    { zone: "critical", widthPct: 30 }, // 0–30
    { zone: "warning",  widthPct: 30 }, // 30–60
    { zone: "good",     widthPct: 40 }, // 60–100
  ],
  toPosition: (v) => Math.min(Math.max(v, 0), 100) / 100,
};

// ── Main component ────────────────────────────────────────────────────────────

export function ObjectiveCard({ country, currentMetrics }: ObjectiveCardProps) {
  const objectives: Objective[] = [
    {
      label: "GDP Growth",
      hint: "higher is better",
      target: "4–8%",
      current: currentMetrics.gdpGrowth,
      format: (v) => `${v.toFixed(1)}%`,
      getZone: (v) => v < 0 ? "critical" : v < 3 ? "warning" : v < 6 ? "good" : "excellent",
      tip: "Spend 35–50% on infrastructure, keep rates near neutral",
      barConfig: gdpBarConfig,
    },
    {
      label: "Inflation",
      hint: "2–4% sweet spot",
      target: "2–4%",
      current: currentMetrics.inflation,
      format: (v) => `${v.toFixed(1)}%`,
      getZone: (v) => v < 0 ? "warning" : v < 2 ? "warning" : v <= 4 ? "excellent" : v < 7 ? "warning" : "critical",
      tip: "Raise rate above neutral to cool, lower to stimulate",
      barConfig: inflBarConfig,
    },
    {
      label: "Budget Deficit",
      hint: "lower is better",
      target: "<3% of GDP",
      current: currentMetrics.deficit,
      format: (v) => `${v.toFixed(1)}%`,
      getZone: (v) => v <= 0 ? "excellent" : v < 3 ? "good" : v < 6 ? "warning" : "critical",
      tip: "Borrow less; surplus earns full points",
      barConfig: deficitBarConfig,
    },
    {
      label: "Trade & Currency",
      hint: "stability rewarded",
      target: "stable FX",
      current: currentMetrics.fxStability,
      format: (v) => v > 0.7 ? "stable" : v > 0.4 ? "volatile" : "crisis",
      getZone: (v) => v > 0.7 ? "good" : v > 0.4 ? "warning" : "critical",
      tip: "Trade deals stabilize your currency",
      barConfig: fxBarConfig,
    },
    {
      label: "Diplomacy",
      hint: "deals & alliances",
      target: "active deals",
      current: currentMetrics.diplomacyScore,
      format: (v) => v > 60 ? "strong" : v > 30 ? "moderate" : "weak",
      getZone: (v) => v > 60 ? "good" : v > 30 ? "warning" : "critical",
      tip: "Propose trade deals each round — both sides benefit",
      barConfig: diplomacyBarConfig,
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-[#E5E0DA] p-4">
      <h3 className="font-bold text-sm tracking-wide mb-3 text-[#1A1A1A]">🎯 YOUR OBJECTIVES</h3>
      <p className="text-[10px] text-[#6B6560] mb-3">Hit these targets to maximise your score:</p>

      {objectives.map((obj) => {
        const zone = obj.getZone(obj.current);
        return (
          <div key={obj.label} className="mb-3 last:mb-0">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-semibold text-[#1A1A1A]">{obj.label}</span>
              <span className="text-[10px] text-[#6B6560]">{obj.hint}</span>
            </div>
            <div className="flex justify-between items-center mt-0.5">
              <span className="text-[10px] text-[#6B6560]">target: {obj.target}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${ZONE_TEXT[zone]}`}>
                {obj.format(obj.current)}
              </span>
            </div>
            <MiniZoneBar value={obj.current} barConfig={obj.barConfig} />
          </div>
        );
      })}

      <div className="border-t border-[#E5E0DA] mt-3 pt-3">
        <p className="text-[10px] text-[#6B6560] font-semibold mb-1.5 uppercase tracking-wider">Quick Guide</p>
        <ul className="text-[10px] text-[#6B6560] space-y-1 leading-relaxed">
          <li>• Grow GDP → spend 35–50% on infrastructure</li>
          <li>• Get inflation to 2–4% → raise rate if too high, lower if too low</li>
          <li className="pl-3 text-[#9B9490]">Your neutral rate is <span className="font-mono font-semibold">{country.rNeutral}%</span> — above this cools, below stimulates</li>
          <li>• Avoid debt trap → borrow under 5% of GDP</li>
          <li>• Trade → form deals, cover your deficits, export surplus</li>
          <li>• Balance all 5 → no single metric wins alone</li>
        </ul>
      </div>
    </div>
  );
}
