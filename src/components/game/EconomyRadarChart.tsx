"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface EconomyRadarProps {
  gdpGrowth: number;
  inflation: number;
  fiscalDeficit: number;
  currencyIndex: number;
  diplomacyScore: number;
  teamColor?: string;
}

export function EconomyRadarChart({
  gdpGrowth,
  inflation,
  fiscalDeficit,
  currencyIndex,
  diplomacyScore,
  teamColor,
}: EconomyRadarProps) {
  const color = teamColor ?? "#E8792F";

  const normalizedGdp = Math.max(0, Math.min(100, ((gdpGrowth + 5) / 15) * 100));
  const normalizedInflation = Math.max(
    0,
    Math.min(100, (1 - Math.abs(inflation - 2) / 18) * 100)
  );
  const normalizedFiscal = Math.max(
    0,
    Math.min(100, (1 - Math.max(0, fiscalDeficit) / 15) * 100)
  );
  const normalizedCurrency = Math.max(
    0,
    Math.min(100, ((currencyIndex - 40) / 120) * 100)
  );
  const normalizedDiplomacy = Math.max(
    0,
    Math.min(100, ((diplomacyScore + 20) / 70) * 100)
  );

  const data = [
    { metric: "GDP", value: normalizedGdp },
    { metric: "Inflation", value: normalizedInflation },
    { metric: "Fiscal", value: normalizedFiscal },
    { metric: "Currency", value: normalizedCurrency },
    { metric: "Diplomacy", value: normalizedDiplomacy },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E5E0DA] shadow-sm p-3">
      <p className="text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest mb-1">
        Economy Radar
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="#E5E0DA" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 11, fill: "#6B6560", fontFamily: "var(--font-ibm-plex-sans)" }}
          />
          <Radar
            name="Economy"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.3}
          />
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid #E5E0DA",
              borderRadius: 8,
              fontSize: 12,
              color: "#1A1A1A",
            }}
            formatter={(value) => [`${Number(value ?? 0).toFixed(1)}`, "Score"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
