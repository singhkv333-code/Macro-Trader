"use client";

import { useState } from "react";

const COMMODITIES = [
  { key: "oil",      label: "Oil",      emoji: "🛢" },
  { key: "metals",   label: "Metals",   emoji: "⛏" },
  { key: "food",     label: "Food",     emoji: "🌾" },
  { key: "semis",    label: "Semis",    emoji: "💾" },
  { key: "pharma",   label: "Pharma",   emoji: "💊" },
  { key: "textiles", label: "Textiles", emoji: "👕" },
] as const;

type CommodityKey = typeof COMMODITIES[number]["key"];

interface TeamProfile {
  id: string;
  name: string;
  flagEmoji: string;
  color: string;
  isActive: boolean;
  countryProfile?: Record<string, unknown>;
}

interface GlobalCommodityBoardProps {
  teams: TeamProfile[];
  myTeamId?: string;
}

function getNet(profile: Record<string, unknown>, key: CommodityKey): number {
  const prod = profile[`${key}Production`] as number ?? 0;
  const cons = profile[`${key}Consumption`] as number ?? 0;
  return prod - cons;
}

function NetCell({ net }: { net: number }) {
  const color = net > 0 ? "text-[#2D8A5E] font-bold" : net < 0 ? "text-[#C4443A]" : "text-[#9E9890]";
  const bg    = net > 0 ? "bg-[#2D8A5E]/8" : net < 0 ? "bg-[#C4443A]/8" : "";
  return (
    <td className={`text-center px-1.5 py-1.5 font-mono text-[11px] ${color} ${bg} rounded`}>
      {net > 0 ? `+${net}` : net === 0 ? "—" : net}
    </td>
  );
}

export function GlobalCommodityBoard({ teams, myTeamId }: GlobalCommodityBoardProps) {
  const [open, setOpen] = useState(false);
  const [sortBy, setSortBy] = useState<CommodityKey | null>(null);

  const activeTeams = teams.filter(t => t.isActive && t.countryProfile);

  const sorted = sortBy
    ? [...activeTeams].sort(
        (a, b) =>
          getNet(b.countryProfile!, sortBy) - getNet(a.countryProfile!, sortBy)
      )
    : activeTeams;

  return (
    <div className="bg-white border border-[#E5E0DA] rounded-xl shadow-sm overflow-hidden">
      {/* Header — always visible, click to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F8F7F4] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🌐</span>
          <span className="text-xs font-semibold text-[#1B2A4A] uppercase tracking-widest">
            Global Commodity Board
          </span>
          <span className="text-[10px] text-[#9E9890] ml-1">
            — see who exports &amp; imports what
          </span>
        </div>
        <span className="text-[#9E9890] text-xs font-mono">{open ? "▲ hide" : "▼ show"}</span>
      </button>

      {open && (
        <div className="border-t border-[#E5E0DA]">
          {/* Column headers — click to sort */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="bg-[#F5F2EE]">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B6560] uppercase tracking-wider sticky left-0 bg-[#F5F2EE] z-10 min-w-[120px]">
                    Nation
                  </th>
                  {COMMODITIES.map(c => (
                    <th
                      key={c.key}
                      onClick={() => setSortBy(sortBy === c.key ? null : c.key)}
                      className={`text-center px-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-[#EDE9E4] transition-colors ${
                        sortBy === c.key ? "text-[#E8792F] bg-[#E8792F]/10" : "text-[#6B6560]"
                      }`}
                    >
                      <span className="block">{c.emoji}</span>
                      <span>{c.label}</span>
                      {sortBy === c.key && <span className="block text-[8px] text-[#E8792F]">sorted</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((team, i) => {
                  const p = team.countryProfile!;
                  const isMe = team.id === myTeamId;
                  return (
                    <tr
                      key={team.id}
                      className={`border-t border-[#F0EDE8] transition-colors ${
                        isMe ? "bg-[#FEF3EC]" : i % 2 === 0 ? "bg-white" : "bg-[#FAFAF8]"
                      } hover:bg-[#F5F2EE]`}
                    >
                      {/* Country name — sticky left column */}
                      <td className={`px-3 py-1.5 sticky left-0 z-10 ${isMe ? "bg-[#FEF3EC]" : i % 2 === 0 ? "bg-white" : "bg-[#FAFAF8]"}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base leading-none">{team.flagEmoji}</span>
                          <span
                            className={`text-[11px] font-semibold truncate max-w-[80px] ${isMe ? "text-[#E8792F]" : "text-[#1A1A1A]"}`}
                          >
                            {team.name}
                            {isMe && <span className="ml-1 text-[9px] text-[#E8792F]">(you)</span>}
                          </span>
                        </div>
                      </td>
                      {COMMODITIES.map(c => (
                        <NetCell key={c.key} net={getNet(p, c.key)} />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 px-3 py-2 border-t border-[#F0EDE8] bg-[#F8F7F4]">
            <span className="text-[10px] text-[#6B6560] font-semibold uppercase tracking-wider">Legend:</span>
            <span className="text-[10px] text-[#2D8A5E] font-semibold">+N = surplus → can export</span>
            <span className="text-[10px] text-[#C4443A] font-semibold">−N = deficit → needs to import</span>
            <span className="text-[10px] text-[#9E9890]">— = balanced</span>
            <span className="text-[10px] text-[#9E9890] ml-auto">Click column header to sort</span>
          </div>
        </div>
      )}
    </div>
  );
}
