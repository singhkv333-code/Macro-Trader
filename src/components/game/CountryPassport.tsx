"use client";

interface CountryProfile {
  countryName: string;
  startingGdpBillions: number;
  startingGdpGrowth?: number;
  startingInflation?: number;
  startingDebtToGdp?: number;
  startingForex?: number;
  startingCreditRating?: string;
  startingNetBudget?: number;
  rNeutral?: number;
  potentialGrowth?: number;
  productivityFactor?: number;
  tradeMultiplier?: number;
  monetaryPower?: number;
  taxEfficiency?: number;
  creditSpread?: number;
  powerUpName: string;
  powerUpDescription: string;
  powerUpUsed: boolean;
  oilProduction: number;
  oilConsumption: number;
  metalsProduction: number;
  metalsConsumption: number;
  foodProduction: number;
  foodConsumption: number;
  semisProduction: number;
  semisConsumption: number;
  pharmaProduction: number;
  pharmaConsumption: number;
  textilesProduction: number;
  textilesConsumption: number;
}

interface CountryPassportProps {
  flagEmoji: string;
  teamName: string;
  countryProfile: CountryProfile;
  creditRating: string;
}

const creditRatingColor: Record<string, string> = {
  AAA: "bg-[#2D8A5E]/10 text-[#2D8A5E]",
  AA:  "bg-[#2D8A5E]/10 text-[#2D8A5E]",
  A:   "bg-[#2D8A5E]/10 text-[#2D8A5E]",
  BBB: "bg-[#D4943A]/10 text-[#D4943A]",
  BB:  "bg-[#D4943A]/10 text-[#D4943A]",
  B:   "bg-[#C4443A]/10 text-[#C4443A]",
  junk: "bg-[#C4443A]/15 text-[#C4443A]",
};

type ResourceKey = "oil" | "metals" | "food" | "semis" | "pharma" | "textiles";

const RESOURCE_LABELS: Record<ResourceKey, { label: string; emoji: string }> = {
  oil:      { label: "Oil",          emoji: "🛢" },
  metals:   { label: "Metals",       emoji: "⛏" },
  food:     { label: "Food",         emoji: "🌾" },
  semis:    { label: "Semis",        emoji: "💾" },
  pharma:   { label: "Pharma",       emoji: "💊" },
  textiles: { label: "Textiles",     emoji: "👕" },
};

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-[#F0EDE8] last:border-0">
      <span className="text-[11px] text-[#6B6560]">{label}</span>
      <span className="text-[11px] font-semibold font-mono text-[#1A1A1A]">{value}</span>
    </div>
  );
}

export function CountryPassport({
  flagEmoji,
  teamName,
  countryProfile: p,
  creditRating,
}: CountryPassportProps) {
  const resources: Record<ResourceKey, { prod: number; cons: number; net: number }> = {
    oil:      { prod: p.oilProduction,      cons: p.oilConsumption,      net: p.oilProduction      - p.oilConsumption },
    metals:   { prod: p.metalsProduction,   cons: p.metalsConsumption,   net: p.metalsProduction   - p.metalsConsumption },
    food:     { prod: p.foodProduction,     cons: p.foodConsumption,     net: p.foodProduction     - p.foodConsumption },
    semis:    { prod: p.semisProduction,    cons: p.semisConsumption,    net: p.semisProduction    - p.semisConsumption },
    pharma:   { prod: p.pharmaProduction,   cons: p.pharmaConsumption,   net: p.pharmaProduction   - p.pharmaConsumption },
    textiles: { prod: p.textilesProduction, cons: p.textilesConsumption, net: p.textilesProduction - p.textilesConsumption },
  };

  const sortedResources = (Object.entries(resources) as [ResourceKey, { prod: number; cons: number; net: number }][])
    .sort((a, b) => b[1].net - a[1].net);

  return (
    <div className="bg-white rounded-xl border border-[#E5E0DA] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#1B2A4A] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{flagEmoji}</span>
          <div>
            <p className="text-white font-bold text-sm leading-tight font-(family-name:--font-dm-sans)">
              {p.countryName || teamName}
            </p>
            <p className="text-[#A0AEC0] text-[10px] uppercase tracking-widest font-semibold">
              Country Profile
            </p>
          </div>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${creditRatingColor[creditRating] ?? "bg-gray-700 text-gray-300"}`}>
          {creditRating}
        </span>
      </div>

      <div className="p-4 space-y-4">

        {/* ── Economic Fundamentals ── */}
        <div>
          <p className="text-[9px] font-semibold text-[#6B6560] uppercase tracking-wider mb-2">Economic Fundamentals</p>
          <div className="bg-[#F5F2EE] rounded-lg px-3 py-1">
            <StatRow label="Starting GDP" value={`$${p.startingGdpBillions.toLocaleString()}B`} />
            {p.startingGdpGrowth !== undefined && (
              <StatRow label="Starting Growth" value={`${p.startingGdpGrowth.toFixed(1)}%`} />
            )}
            {p.startingInflation !== undefined && (
              <StatRow label="Starting Inflation" value={`${p.startingInflation.toFixed(1)}%`} />
            )}
            {p.startingDebtToGdp !== undefined && (
              <StatRow label="Debt / GDP" value={`${(p.startingDebtToGdp * 100).toFixed(0)}%`} />
            )}
            {p.startingForex !== undefined && (
              <StatRow label="Forex Reserves" value={`$${p.startingForex}B`} />
            )}
            {p.startingCreditRating && (
              <StatRow label="Credit Rating" value={p.startingCreditRating} />
            )}
          </div>
        </div>

        {/* ── Engine Multipliers ── */}
        <div>
          <p className="text-[9px] font-semibold text-[#6B6560] uppercase tracking-wider mb-2">Engine Multipliers</p>
          <div className="bg-[#F5F2EE] rounded-lg px-3 py-1">
            {p.potentialGrowth !== undefined && (
              <StatRow label="Potential Growth" value={`${p.potentialGrowth.toFixed(1)}%`} />
            )}
            {p.rNeutral !== undefined && (
              <StatRow label="Neutral Rate (R*)" value={`${p.rNeutral.toFixed(1)}%`} />
            )}
            {p.productivityFactor !== undefined && (
              <StatRow label="Productivity (A)" value={p.productivityFactor.toFixed(2)} />
            )}
            {p.tradeMultiplier !== undefined && (
              <StatRow label="Trade Multiplier (β)" value={p.tradeMultiplier.toFixed(3)} />
            )}
            {p.monetaryPower !== undefined && (
              <StatRow label="Monetary Power (μ)" value={p.monetaryPower.toFixed(2)} />
            )}
            {p.taxEfficiency !== undefined && (
              <StatRow label="Tax Efficiency" value={`${(p.taxEfficiency * 100).toFixed(0)}%`} />
            )}
            {p.creditSpread !== undefined && (
              <StatRow label="Credit Spread" value={`${(p.creditSpread * 100).toFixed(1)}%`} />
            )}
          </div>
        </div>

        {/* ── Commodity Matrix ── */}
        <div>
          <p className="text-[9px] font-semibold text-[#6B6560] uppercase tracking-wider mb-2">Commodity Balance</p>
          <div className="rounded-lg overflow-hidden border border-[#E5E0DA]">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-[#F5F2EE]">
                  <th className="text-left px-2 py-1.5 text-[#6B6560] font-semibold">Commodity</th>
                  <th className="text-center px-2 py-1.5 text-[#6B6560] font-semibold">Prod</th>
                  <th className="text-center px-2 py-1.5 text-[#6B6560] font-semibold">Cons</th>
                  <th className="text-right px-2 py-1.5 text-[#6B6560] font-semibold">Net</th>
                </tr>
              </thead>
              <tbody>
                {sortedResources.map(([key, { prod, cons, net }]) => (
                  <tr key={key} className="border-t border-[#F0EDE8]">
                    <td className="px-2 py-1.5 text-[#1A1A1A]">
                      {RESOURCE_LABELS[key].emoji} {RESOURCE_LABELS[key].label}
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono text-[#6B6560]">{prod}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-[#6B6560]">{cons}</td>
                    <td className={`px-2 py-1.5 text-right font-mono font-bold ${net > 0 ? "text-[#2D8A5E]" : net < 0 ? "text-[#C4443A]" : "text-[#6B6560]"}`}>
                      {net > 0 ? `+${net}` : net}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Power-up ── */}
        <div className={`rounded-xl border p-3 ${p.powerUpUsed ? "bg-gray-50 border-[#E5E0DA] opacity-60" : "bg-[#FEF3EC] border-[#E8792F]/20"}`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-[#E8792F] uppercase tracking-wider">⚡ Power-Up</p>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${p.powerUpUsed ? "bg-gray-200 text-gray-500" : "bg-[#E8792F]/15 text-[#E8792F]"}`}>
              {p.powerUpUsed ? "USED" : "AVAILABLE"}
            </span>
          </div>
          <p className="text-xs font-semibold text-[#1A1A1A]">{p.powerUpName}</p>
          <p className="text-[11px] text-[#6B6560] mt-0.5 leading-snug">{p.powerUpDescription}</p>
        </div>

      </div>
    </div>
  );
}
