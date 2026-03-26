"use client";

import { Button } from "@/components/ui/button";

interface CountryProfile {
  countryName: string;
  startingGdpBillions: number;
  startingGdpGrowth?: number;
  startingInflation?: number;
  startingDebtToGdp?: number;
  startingForex?: number;
  rNeutral?: number;
  startingCreditRating?: string;
  powerUpName: string;
  powerUpDescription: string;
  challengeText?: string;
  oilProduction: number; oilConsumption: number;
  metalsProduction: number; metalsConsumption: number;
  foodProduction: number; foodConsumption: number;
  semisProduction: number; semisConsumption: number;
  pharmaProduction: number; pharmaConsumption: number;
  textilesProduction: number; textilesConsumption: number;
}

interface CountryBriefingProps {
  flagEmoji: string;
  teamName: string;
  countryProfile: CountryProfile;
  onEnter: () => void;
}

const RESOURCE_INFO: Record<string, { label: string; emoji: string }> = {
  oil:      { label: "Oil",      emoji: "🛢" },
  metals:   { label: "Metals",   emoji: "⛏" },
  food:     { label: "Food",     emoji: "🌾" },
  semis:    { label: "Semis",    emoji: "💾" },
  pharma:   { label: "Pharma",   emoji: "💊" },
  textiles: { label: "Textiles", emoji: "👕" },
};

export function CountryBriefing({ flagEmoji, teamName, countryProfile: p, onEnter }: CountryBriefingProps) {
  const gdpLabel = p.startingGdpBillions >= 1000
    ? `$${(p.startingGdpBillions / 1000).toFixed(1)}T`
    : `$${p.startingGdpBillions}B`;

  const commodities = [
    { key: "oil",      prod: p.oilProduction,      cons: p.oilConsumption },
    { key: "metals",   prod: p.metalsProduction,   cons: p.metalsConsumption },
    { key: "food",     prod: p.foodProduction,     cons: p.foodConsumption },
    { key: "semis",    prod: p.semisProduction,    cons: p.semisConsumption },
    { key: "pharma",   prod: p.pharmaProduction,   cons: p.pharmaConsumption },
    { key: "textiles", prod: p.textilesProduction, cons: p.textilesConsumption },
  ].map(c => ({ ...c, net: c.prod - c.cons })).sort((a, b) => b.net - a.net);

  const surpluses = commodities.filter(c => c.net > 0);
  const deficits  = commodities.filter(c => c.net < 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1628]/90 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[#1B2A4A] rounded-t-2xl px-6 py-5 text-center">
          <div className="text-5xl mb-2">{flagEmoji}</div>
          <h1 className="text-white text-xl font-bold">{p.countryName || teamName}</h1>
          <p className="text-[#A0AEC0] text-xs uppercase tracking-widest mt-1">Your Country Briefing</p>
        </div>

        <div className="p-5 space-y-5">
          {/* Economic Fundamentals */}
          <div>
            <p className="text-[10px] font-bold text-[#6B6560] uppercase tracking-wider mb-2">Economic Fundamentals</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "GDP",        val: gdpLabel },
                { label: "Growth",     val: `${p.startingGdpGrowth ?? "—"}%` },
                { label: "Inflation",  val: `${p.startingInflation ?? "—"}%` },
                { label: "Debt/GDP",   val: p.startingDebtToGdp != null ? `${(p.startingDebtToGdp * 100).toFixed(0)}%` : "—" },
                { label: "Forex",      val: p.startingForex != null ? `$${p.startingForex}B` : "—" },
                { label: "Neutral R*", val: p.rNeutral != null ? `${p.rNeutral}%` : "—" },
              ].map(({ label, val }) => (
                <div key={label} className="bg-[#F5F2EE] rounded-lg p-2 text-center">
                  <p className="text-[9px] text-[#6B6560] uppercase font-semibold">{label}</p>
                  <p className="text-sm font-bold font-mono text-[#1A1A1A] mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <p className="text-[10px] font-bold text-[#6B6560] uppercase tracking-wider mb-2">Your Resources</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#EAF6F0] rounded-lg p-3">
                <p className="text-[10px] font-bold text-[#2D8A5E] uppercase mb-1">Surplus (Export)</p>
                {surpluses.length > 0 ? surpluses.map(c => (
                  <p key={c.key} className="text-xs text-[#1A1A1A]">
                    {RESOURCE_INFO[c.key].emoji} {RESOURCE_INFO[c.key].label}{" "}
                    <span className="font-mono font-bold text-[#2D8A5E]">+{c.net}</span>
                  </p>
                )) : <p className="text-xs text-[#6B6560]">None</p>}
              </div>
              <div className="bg-[#FEF0EE] rounded-lg p-3">
                <p className="text-[10px] font-bold text-[#C4443A] uppercase mb-1">Deficit (Import)</p>
                {deficits.length > 0 ? deficits.map(c => (
                  <p key={c.key} className="text-xs text-[#1A1A1A]">
                    {RESOURCE_INFO[c.key].emoji} {RESOURCE_INFO[c.key].label}{" "}
                    <span className="font-mono font-bold text-[#C4443A]">{c.net}</span>
                  </p>
                )) : <p className="text-xs text-[#6B6560]">None</p>}
              </div>
            </div>
          </div>

          {/* Challenge */}
          {p.challengeText && (
            <div className="bg-[#F5F2EE] rounded-xl p-4 border-l-4 border-[#E8792F]">
              <p className="text-[10px] font-bold text-[#E8792F] uppercase tracking-wider mb-1">Your Challenge</p>
              <p className="text-xs text-[#1A1A1A] leading-relaxed">{p.challengeText}</p>
            </div>
          )}

          {/* Power-Up */}
          <div className="bg-[#FEF3EC] rounded-xl p-4 border border-[#E8792F]/20">
            <p className="text-[10px] font-bold text-[#E8792F] uppercase tracking-wider mb-1">⚡ Your Power-Up</p>
            <p className="text-sm font-bold text-[#1A1A1A]">{p.powerUpName}</p>
            <p className="text-xs text-[#6B6560] mt-1 leading-relaxed">{p.powerUpDescription}</p>
          </div>

          <Button
            onClick={onEnter}
            className="w-full h-12 bg-[#E8792F] hover:bg-[#d16a25] text-white font-bold rounded-xl text-base"
          >
            Enter Game →
          </Button>
        </div>
      </div>
    </div>
  );
}
