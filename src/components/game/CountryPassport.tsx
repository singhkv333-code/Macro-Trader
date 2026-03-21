"use client";

interface CountryProfile {
  countryName: string;
  startingGdpBillions: number;
  startingNetBudget?: number;
  rNeutral?: number;
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

const RESOURCE_LABELS: Record<ResourceKey, string> = {
  oil: "Oil",
  metals: "Metals",
  food: "Food",
  semis: "Semis",
  pharma: "Pharma",
  textiles: "Textiles",
};

export function CountryPassport({
  flagEmoji,
  teamName,
  countryProfile: p,
  creditRating,
}: CountryPassportProps) {
  // Compute resource balances (positive = surplus/strength, negative = deficit/weakness)
  const resources: Record<ResourceKey, number> = {
    oil:      p.oilProduction - p.oilConsumption,
    metals:   p.metalsProduction - p.metalsConsumption,
    food:     p.foodProduction - p.foodConsumption,
    semis:    p.semisProduction - p.semisConsumption,
    pharma:   p.pharmaProduction - p.pharmaConsumption,
    textiles: p.textilesProduction - p.textilesConsumption,
  };

  const sorted = (Object.entries(resources) as [ResourceKey, number][]).sort(
    (a, b) => b[1] - a[1]
  );
  const strengths = sorted.filter(([, v]) => v >= 0).slice(0, 2);
  const weaknesses = sorted.filter(([, v]) => v < 0).slice(-2).reverse();

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
              Economic Passport
            </p>
          </div>
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            creditRatingColor[creditRating] ?? "bg-gray-700 text-gray-300"
          }`}
        >
          {creditRating}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Key stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#F5F2EE] rounded-lg p-2 text-center">
            <p className="text-[9px] font-semibold text-[#6B6560] uppercase tracking-wider">GDP</p>
            <p className="font-mono tabular-nums text-sm font-bold text-[#1A1A1A]">
              ${p.startingGdpBillions}B
            </p>
          </div>
          {p.startingNetBudget !== undefined && (
            <div className="bg-[#F5F2EE] rounded-lg p-2 text-center">
              <p className="text-[9px] font-semibold text-[#6B6560] uppercase tracking-wider">Budget</p>
              <p className="font-mono tabular-nums text-sm font-bold text-[#1A1A1A]">
                ${p.startingNetBudget}B
              </p>
            </div>
          )}
          {p.rNeutral !== undefined && (
            <div className="bg-[#F5F2EE] rounded-lg p-2 text-center">
              <p className="text-[9px] font-semibold text-[#6B6560] uppercase tracking-wider">R*</p>
              <p className="font-mono tabular-nums text-sm font-bold text-[#1A1A1A]">
                {p.rNeutral}%
              </p>
            </div>
          )}
          {p.startingNetBudget === undefined && p.rNeutral === undefined && (
            <div className="col-span-2" />
          )}
        </div>

        {/* Strengths & Weaknesses */}
        {(strengths.length > 0 || weaknesses.length > 0) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] font-semibold text-[#2D8A5E] uppercase tracking-wider mb-1.5">
                Strengths
              </p>
              <div className="space-y-1">
                {strengths.length > 0 ? (
                  strengths.map(([key, val]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between bg-[#2D8A5E]/8 rounded-lg px-2 py-1"
                    >
                      <span className="text-xs text-[#1A1A1A]">{RESOURCE_LABELS[key]}</span>
                      <span className="font-mono tabular-nums text-[10px] text-[#2D8A5E] font-semibold">
                        +{val}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#6B6560]">—</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-semibold text-[#C4443A] uppercase tracking-wider mb-1.5">
                Weaknesses
              </p>
              <div className="space-y-1">
                {weaknesses.length > 0 ? (
                  weaknesses.map(([key, val]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between bg-[#C4443A]/8 rounded-lg px-2 py-1"
                    >
                      <span className="text-xs text-[#1A1A1A]">{RESOURCE_LABELS[key]}</span>
                      <span className="font-mono tabular-nums text-[10px] text-[#C4443A] font-semibold">
                        {val}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#6B6560]">—</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Power-up */}
        <div
          className={`rounded-xl border p-3 ${
            p.powerUpUsed
              ? "bg-gray-50 border-[#E5E0DA] opacity-60"
              : "bg-[#FEF3EC] border-[#E8792F]/20"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-[#E8792F] uppercase tracking-wider">
              ⚡ Power-Up
            </p>
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                p.powerUpUsed
                  ? "bg-gray-200 text-gray-500"
                  : "bg-[#E8792F]/15 text-[#E8792F]"
              }`}
            >
              {p.powerUpUsed ? "USED" : "AVAILABLE"}
            </span>
          </div>
          <p className="text-xs font-semibold text-[#1A1A1A]">{p.powerUpName}</p>
          <p className="text-[11px] text-[#6B6560] mt-0.5 leading-snug">
            {p.powerUpDescription}
          </p>
        </div>
      </div>
    </div>
  );
}
