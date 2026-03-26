"use client";

import { useAuth } from "@/hooks/useAuth";
import { useGameState } from "@/hooks/useGameState";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { ROUND_SCENARIOS } from "@/lib/constants";
import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Banknote,
  ArrowUpCircle,
  Globe,
  Briefcase,
  Handshake,
  CheckCircle,
} from "lucide-react";

import { EconomyRadarChart } from "@/components/game/EconomyRadarChart";
import { LeaderboardBars } from "@/components/game/LeaderboardBars";
import { NewsTicker } from "@/components/game/NewsTicker";
import { RoundIntroOverlay } from "@/components/game/RoundIntroOverlay";
import { CountryBriefing } from "@/components/game/CountryBriefing";

function getMetricStatus(key: string, value: number): "healthy" | "warning" | "critical" {
  switch (key) {
    case "gdpGrowth": return value > 2 ? "healthy" : value > 0 ? "warning" : "critical";
    case "inflation": return value < 6 ? "healthy" : value < 10 ? "warning" : "critical";
    case "unemployment": return value < 6 ? "healthy" : value < 9 ? "warning" : "critical";
    case "fiscalDeficit": return value < 3 ? "healthy" : value < 6 ? "warning" : "critical";
    case "currencyIndex": return value > 85 ? "healthy" : value > 65 ? "warning" : "critical";
    case "approvalRating": return value > 50 ? "healthy" : value > 30 ? "warning" : "critical";
    default: return "healthy";
  }
}

// Plain-English economy summary for players who aren't econ-savvy
function getEconomySummary(state: {
  gdpGrowth: number; inflation: number; fiscalDeficit: number;
  unemployment: number; currencyIndex: number; approvalRating: number;
} | null): { grade: string; color: string; items: { icon: string; text: string; status: "ok" | "warn" | "bad" }[] } {
  if (!state) return { grade: "No data yet", color: "text-[#6B6560]", items: [] };

  const items: { icon: string; text: string; status: "ok" | "warn" | "bad" }[] = [];

  // GDP
  if (state.gdpGrowth > 3)
    items.push({ icon: "📈", text: `Economy growing at ${state.gdpGrowth.toFixed(1)}% — strong`, status: "ok" });
  else if (state.gdpGrowth > 0)
    items.push({ icon: "📊", text: `Economy growing slowly at ${state.gdpGrowth.toFixed(1)}% — needs attention`, status: "warn" });
  else
    items.push({ icon: "📉", text: `Economy shrinking (${state.gdpGrowth.toFixed(1)}%) — act fast!`, status: "bad" });

  // Inflation
  if (state.inflation < 5)
    items.push({ icon: "✅", text: `Prices stable at ${state.inflation.toFixed(1)}% inflation`, status: "ok" });
  else if (state.inflation < 9)
    items.push({ icon: "⚠️", text: `Inflation at ${state.inflation.toFixed(1)}% — raise interest rates`, status: "warn" });
  else
    items.push({ icon: "🔥", text: `Inflation crisis: ${state.inflation.toFixed(1)}% — raise rates now!`, status: "bad" });

  // Deficit
  if (state.fiscalDeficit < 3)
    items.push({ icon: "✅", text: "Budget balanced — good fiscal discipline", status: "ok" });
  else if (state.fiscalDeficit < 6)
    items.push({ icon: "⚠️", text: `Deficit ${state.fiscalDeficit.toFixed(1)}% — reduce borrowing`, status: "warn" });
  else
    items.push({ icon: "🚨", text: `High deficit: ${state.fiscalDeficit.toFixed(1)}% — credit rating at risk`, status: "bad" });

  const bads = items.filter(i => i.status === "bad").length;
  const warns = items.filter(i => i.status === "warn").length;
  const grade = bads > 1 ? "Economy in Trouble" : bads === 1 ? "Needs Attention" : warns > 1 ? "Holding Steady" : "Performing Well";
  const color = bads > 1 ? "text-[#C4443A]" : bads === 1 ? "text-[#C4443A]" : warns > 1 ? "text-[#D4943A]" : "text-[#2D8A5E]";
  return { grade, color, items };
}

interface TradeRequest {
  id: string;
  status: string;
  proposer: { id: string; name: string; flagEmoji: string; color: string };
  commodity?: string;
  terms?: string;
}

export default function TeamDashboard() {
  const { user } = useAuth();
  const { game, teams, news, relations, scores, previousScores } = useGameState(3000);
  const router = useRouter();

  const [showRoundIntro, setShowRoundIntro] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);

  // ── Incoming trade requests ──────────────────────────────────────────────
  const [tradeRequests, setTradeRequests] = useState<TradeRequest[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const fetchTradeRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/team/trade/requests");
      if (res.ok) {
        const data = await res.json();
        setTradeRequests(data.requests ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchTradeRequests();
    const interval = setInterval(fetchTradeRequests, 3000);
    return () => clearInterval(interval);
  }, [fetchTradeRequests]);

  const respondToTrade = async (agreementId: string, response: "accepted" | "rejected") => {
    try {
      await fetch("/api/team/trade/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreementId, response }),
      });
      setDismissedIds(prev => new Set([...prev, agreementId]));
      fetchTradeRequests();
    } catch { /* ignore */ }
  };

  const visibleRequests = tradeRequests.filter(r => !dismissedIds.has(r.id));

  const myTeam = teams.find((t) => t.id === user?.teamId);
  const currentState = myTeam?.roundStates?.[0];

  // Check if team already submitted for current round
  const latestDecision = myTeam?.decisions?.[0];
  const hasSubmittedThisRound = latestDecision?.round === (game?.currentRound || 0);

  const prevRoundStates = myTeam?.roundStates;
  const prevState = prevRoundStates && prevRoundStates.length > 1 ? prevRoundStates[1] : null;

  const currentRound = game?.currentRound || 0;
  const scenario = ROUND_SCENARIOS[currentRound];

  // Show intro only once per round — use sessionStorage
  useEffect(() => {
    if (game?.phase === "input" && currentRound > 0) {
      const key = `roundIntroSeen_${currentRound}`;
      if (!sessionStorage.getItem(key)) {
        setShowRoundIntro(true);
        sessionStorage.setItem(key, "1");
      }
    }
  }, [game?.phase, currentRound]);

  // Show country briefing once per login session
  useEffect(() => {
    if (user?.teamId && !sessionStorage.getItem("briefingSeen")) {
      setShowBriefing(true);
    }
  }, [user?.teamId]);

  const getDelta = (key: string) => {
    if (!currentState || !prevState) return undefined;
    const cur = (currentState as unknown as Record<string, unknown>)[key] as number;
    const prv = (prevState as unknown as Record<string, unknown>)[key] as number;
    return cur - prv;
  };

  // Build sparkline data from round history (oldest → newest)
  const getSparkData = (key: string): number[] => {
    if (!myTeam?.roundStates || myTeam.roundStates.length < 2) return [];
    return [...myTeam.roundStates]
      .reverse()
      .map((s) => (s as unknown as Record<string, unknown>)[key] as number)
      .filter((v) => typeof v === "number");
  };

  const phaseText =
    game?.phase === "input" ? "Decisions Open" :
    game?.phase === "simulating" ? "Simulating..." :
    game?.phase === "results" ? "Results Available" : "Waiting...";
  const phaseColor =
    game?.phase === "input" ? "bg-green-500" :
    game?.phase === "results" ? "bg-blue-500" : "bg-amber-500";

  const myRelations = relations.filter(
    (relation) => relation.fromTeamId === user?.teamId || relation.toTeamId === user?.teamId
  );

  const creditRating = currentState?.creditRating ?? "A";

  // Leaderboard entries derived from scores
  const previousScoreByTeam = previousScores.reduce<Record<string, number>>((acc, s) => {
    acc[s.teamId] = s.total;
    return acc;
  }, {});

  const leaderboardEntries = scores.map((s) => {
    const team = teams.find((t) => t.id === s.teamId);
    return {
      teamId: s.teamId,
      teamName: team?.name ?? "",
      flagEmoji: team?.flagEmoji ?? "",
      color: team?.color ?? "#888",
      total: s.total,
      delta: s.total - (previousScoreByTeam[s.teamId] ?? s.total),
      isMe: s.teamId === user?.teamId,
    };
  });

  // Compute diplomacy score for radar
  const myDiplomacyScore = myRelations.reduce((acc, rel) => {
    if (rel.type === "trade_deal") return acc + 10;
    if (rel.type === "alliance") return acc + 8;
    if (rel.type === "sanctions" || rel.type === "trade_war") return acc - 5;
    if (rel.type === "conflict") return acc - 12;
    return acc;
  }, 0);

  // Country profile (may be undefined for teams without extended profile)
  const profile = (myTeam as unknown as { countryProfile?: Record<string, unknown> })?.countryProfile;

  return (
    <div className="space-y-6 animate-fade-in pb-32 lg:pb-8">
      {/* ── Country Briefing (first login) ── */}
      {showBriefing && profile && (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <CountryBriefing
          flagEmoji={myTeam?.flagEmoji ?? "🌐"}
          teamName={myTeam?.name ?? ""}
          countryProfile={profile as any}
          onEnter={() => {
            sessionStorage.setItem("briefingSeen", "1");
            setShowBriefing(false);
          }}
        />
      )}

      {/* ── Round Intro Overlay ── */}
      {showRoundIntro && scenario && (
        <RoundIntroOverlay
          round={currentRound}
          scenario={scenario}
          teamName={myTeam?.name ?? ""}
          flagEmoji={myTeam?.flagEmoji ?? "🌐"}
          onDismiss={() => setShowRoundIntro(false)}
        />
      )}

      {/* ── Incoming Trade Deal Notifications ── */}
      {visibleRequests.length > 0 && (
        <div className="space-y-2">
          {visibleRequests.map(req => (
            <div
              key={req.id}
              className="flex flex-wrap items-center gap-3 bg-[#EAF6F0] border border-[#2D8A5E]/30 rounded-xl px-4 py-3"
            >
              <span className="text-lg">{req.proposer.flagEmoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1B2A4A]">
                  📨 {req.proposer.name} wants to form a trade deal with you!
                </p>
                <p className="text-xs text-[#6B6560]">Respond before the round ends</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  className="bg-[#2D8A5E] hover:bg-[#236b49] text-white rounded-lg h-8 px-3 text-xs"
                  onClick={() => respondToTrade(req.id, "accepted")}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#C4443A]/40 text-[#C4443A] hover:bg-[#C4443A]/10 rounded-lg h-8 px-3 text-xs"
                  onClick={() => respondToTrade(req.id, "rejected")}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[#6B6560] hover:bg-[#F5F2EE] rounded-lg h-8 px-2 text-xs"
                  onClick={() => setDismissedIds(prev => new Set([...prev, req.id]))}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A] font-(family-name:--font-dm-sans)">
            {myTeam?.flagEmoji} {myTeam?.name}
          </h1>
        </div>
        {/* Desktop CTA */}
        {game?.phase === "input" && !hasSubmittedThisRound && (
          <Button
            onClick={() => router.push("/team/decide")}
            className="hidden lg:flex bg-[#E8792F] hover:bg-[#d16a25] text-white font-semibold rounded-lg h-11 px-7"
          >
            <ArrowUpCircle className="mr-2 h-4 w-4" />
            Make Decisions
          </Button>
        )}
        {game?.phase === "input" && hasSubmittedThisRound && (
          <Badge className="hidden lg:flex bg-green-100 text-green-700 px-4 py-2 text-sm">
            <CheckCircle className="h-4 w-4 mr-1.5" /> Decisions Submitted
          </Badge>
        )}
      </div>

      {/* ── Country Profile Banner — horizontal, full width ── */}
      {profile && (() => {
        const p = profile as Record<string, unknown>;
        const gdpB = p.startingGdpBillions as number;
        const gdpLabel = gdpB >= 1000 ? `$${(gdpB / 1000).toFixed(1)}T` : `$${gdpB}B`;
        const commodities = [
          { key: "oil",      label: "Oil",      emoji: "🛢", prod: p.oilProduction as number,      cons: p.oilConsumption as number },
          { key: "metals",   label: "Metals",   emoji: "⛏", prod: p.metalsProduction as number,   cons: p.metalsConsumption as number },
          { key: "food",     label: "Food",     emoji: "🌾", prod: p.foodProduction as number,     cons: p.foodConsumption as number },
          { key: "semis",    label: "Semis",    emoji: "💾", prod: p.semisProduction as number,    cons: p.semisConsumption as number },
          { key: "pharma",   label: "Pharma",   emoji: "💊", prod: p.pharmaProduction as number,   cons: p.pharmaConsumption as number },
          { key: "textiles", label: "Textiles", emoji: "👕", prod: p.textilesProduction as number, cons: p.textilesConsumption as number },
        ].map(c => ({ ...c, net: c.prod - c.cons }));
        const powerUsed = !!(p.powerUpUsed as boolean);
        return (
          <div className="bg-[#1B2A4A] rounded-xl overflow-hidden shadow-sm">
            {/* ── Row 1: Identity + Economic Fundamentals + Commodity Table ── */}
            <div className="flex flex-wrap lg:flex-nowrap divide-y lg:divide-y-0 lg:divide-x divide-white/10 px-0">

              {/* Identity block */}
              <div className="flex items-center gap-3 px-4 py-3 lg:w-48 shrink-0">
                <span className="text-3xl leading-none">{myTeam?.flagEmoji}</span>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">{p.countryName as string || myTeam?.name}</p>
                  <p className="text-[#A0AEC0] text-[10px] uppercase tracking-widest font-semibold mt-0.5">Country Profile</p>
                </div>
              </div>

              {/* Economic fundamentals */}
              <div className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3 flex-1 items-center">
                {[
                  { label: "GDP",      val: gdpLabel },
                  { label: "Growth",   val: `${p.startingGdpGrowth as number}%` },
                  { label: "Inflation", val: `${p.startingInflation as number}%` },
                  { label: "Debt/GDP", val: `${((p.startingDebtToGdp as number) * 100).toFixed(0)}%` },
                  { label: "R*",       val: `${p.rNeutral as number}%` },
                  { label: "Credit",   val: p.startingCreditRating as string },
                ].map(({ label, val }) => (
                  <div key={label} className="text-center min-w-[40px]">
                    <p className="text-[9px] text-[#A0AEC0] uppercase tracking-wider font-semibold">{label}</p>
                    <p className="text-white text-xs font-mono font-bold mt-0.5">{val}</p>
                  </div>
                ))}
              </div>

              {/* Commodity balance — compact table */}
              <div className="px-4 py-3 shrink-0">
                <p className="text-[9px] text-[#A0AEC0] uppercase tracking-wider font-semibold mb-1.5">Commodities</p>
                <table className="text-[10px] leading-snug">
                  <thead>
                    <tr>
                      <th className="text-left pr-2 text-[#A0AEC0] font-medium pb-0.5"></th>
                      <th className="text-right pr-1 text-[#A0AEC0] font-medium pb-0.5">Prod</th>
                      <th className="text-right pr-1 text-[#A0AEC0] font-medium pb-0.5">Cons</th>
                      <th className="text-right text-[#A0AEC0] font-medium pb-0.5">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commodities.map(c => (
                      <tr key={c.key}>
                        <td className="pr-2 text-white/80">{c.emoji} {c.label}</td>
                        <td className="text-right pr-1 font-mono text-white/70">{c.prod}</td>
                        <td className="text-right pr-1 font-mono text-white/70">{c.cons}</td>
                        <td className={`text-right font-mono font-bold ${c.net > 0 ? "text-[#2D8A5E]" : c.net < 0 ? "text-[#C4443A]" : "text-white/50"}`}>
                          {c.net > 0 ? `+${c.net}` : c.net}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Separator ── */}
            <div className="border-t border-white/10" />

            {/* ── Row 2: Engine Multipliers + Power-Up ── */}
            <div className="flex flex-wrap lg:flex-nowrap divide-y lg:divide-y-0 lg:divide-x divide-white/10">

              {/* Engine multipliers */}
              <div className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3 flex-1 items-center">
                <p className="text-[9px] text-[#A0AEC0] uppercase tracking-wider font-semibold w-full mb-0">Engine Multipliers</p>
                {[
                  { label: "Productivity (A)",   val: `${(p.productivityFactor as number)?.toFixed(2) ?? "—"}` },
                  { label: "Trade (β)",          val: `${(p.tradeMultiplier as number)?.toFixed(2) ?? "—"}` },
                  { label: "Monetary (μ)",       val: `${(p.monetaryPower as number)?.toFixed(2) ?? "—"}` },
                  { label: "Tax Efficiency",     val: `${((p.taxEfficiency as number) * 100).toFixed(0)}%` },
                  { label: "Potential Growth",   val: `${p.potentialGrowth as number}%` },
                  { label: "Credit Spread",      val: `${((p.creditSpread as number) * 100).toFixed(1)}%` },
                ].map(({ label, val }) => (
                  <div key={label} className="text-center min-w-[60px]">
                    <p className="text-[9px] text-[#A0AEC0] uppercase tracking-wider font-semibold">{label}</p>
                    <p className="text-white text-xs font-mono font-bold mt-0.5">{val}</p>
                  </div>
                ))}
              </div>

              {/* Power-up */}
              <div className={`flex items-start gap-2 px-4 py-3 lg:w-64 shrink-0 ${powerUsed ? "opacity-50" : ""}`}>
                <span className="text-lg shrink-0 mt-0.5">⚡</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[9px] text-[#E8792F] uppercase tracking-wider font-semibold">Power-Up</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${powerUsed ? "bg-white/10 text-white/50" : "bg-[#E8792F]/20 text-[#E8792F]"}`}>
                      {powerUsed ? "USED" : "AVAILABLE"}
                    </span>
                  </div>
                  <p className="text-white text-[11px] font-semibold leading-tight">{p.powerUpName as string}</p>
                  <p className="text-[#A0AEC0] text-[10px] leading-snug mt-0.5">{(p.powerUpDescription as string)?.slice(0, 80)}{(p.powerUpDescription as string)?.length > 80 ? "…" : ""}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Context bar ── */}
      <div className="bg-white border border-[#E5E0DA] border-l-4 border-l-[#E8792F] rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-[#1A1A1A] font-(family-name:--font-dm-sans)">
          Round {currentRound} of 4
        </span>
        {scenario && currentRound > 0 && (
          <>
            <span className="text-[#6B6560]">·</span>
            <span className="text-[#6B6560]">{scenario.title}</span>
          </>
        )}
        <span className="text-[#6B6560]">·</span>
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${phaseColor} animate-pulse`} />
          <span className="text-[#6B6560]">{phaseText}</span>
        </span>
      </div>

      {/* ── Economy at a Glance — plain-English summary ── */}
      {currentState && (() => {
        const summary = getEconomySummary({
          gdpGrowth: currentState.gdpGrowth,
          inflation: currentState.inflation,
          fiscalDeficit: currentState.fiscalDeficit,
          unemployment: currentState.unemployment,
          currencyIndex: currentState.currencyIndex,
          approvalRating: currentState.approvalRating,
        });
        return (
          <div className="bg-white border border-[#E5E0DA] rounded-xl px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest">Economy at a Glance</span>
              <span className={`text-sm font-bold font-(family-name:--font-dm-sans) ${summary.color}`}>{summary.grade}</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {summary.items.map((item, i) => (
                <span key={i} className={`text-xs ${item.status === "ok" ? "text-[#2D8A5E]" : item.status === "warn" ? "text-[#D4943A]" : "text-[#C4443A]"}`}>
                  {item.icon} {item.text}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ══ Column 1: Your Economy ══ */}
        <div className="lg:col-span-1 space-y-5">
          <h2 className="text-xs font-semibold text-[#6B6560] uppercase tracking-widest">
            Your Economy
          </h2>

          {/* Economy Radar Chart */}
          <EconomyRadarChart
            gdpGrowth={currentState?.gdpGrowth ?? 3}
            inflation={currentState?.inflation ?? 4}
            fiscalDeficit={currentState?.fiscalDeficit ?? 0}
            currencyIndex={currentState?.currencyIndex ?? 100}
            diplomacyScore={myDiplomacyScore}
            teamColor={myTeam?.color}
          />

          {/* Primary metrics — big cards with sparklines */}
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="GDP Growth"
              value={currentState?.gdpGrowth ?? 0}
              icon={TrendingUp}
              delta={getDelta("gdpGrowth")}
              unit="%"
              status={getMetricStatus("gdpGrowth", currentState?.gdpGrowth ?? 0)}
              sparkData={getSparkData("gdpGrowth")}
            />
            <MetricCard
              label="Inflation"
              value={currentState?.inflation ?? 0}
              icon={TrendingDown}
              delta={getDelta("inflation")}
              unit="%"
              status={getMetricStatus("inflation", currentState?.inflation ?? 0)}
              sparkData={getSparkData("inflation")}
            />
            <MetricCard
              label="Fiscal Deficit"
              value={currentState?.fiscalDeficit ?? 0}
              icon={Banknote}
              delta={getDelta("fiscalDeficit")}
              unit="%"
              status={getMetricStatus("fiscalDeficit", currentState?.fiscalDeficit ?? 0)}
              sparkData={getSparkData("fiscalDeficit")}
            />
            <MetricCard
              label="Trade Income"
              value={currentState?.tradeIncome ?? 0}
              icon={DollarSign}
              delta={getDelta("tradeIncome")}
              status="healthy"
              sparkData={getSparkData("tradeIncome")}
            />
          </div>

        </div>

        {/* ══ Column 2: Global Intelligence ══ */}
        <div className="lg:col-span-1 space-y-5">
          <h2 className="text-xs font-semibold text-[#6B6560] uppercase tracking-widest flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" /> Global Intelligence
          </h2>

          <div className="bg-white rounded-xl border border-[#E5E0DA] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-70">
                <thead>
                  <tr className="border-b border-[#E5E0DA] bg-[#F5F2EE]/60">
                    <th className="text-left p-3 text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest">Nation</th>
                    <th className="text-right p-3 text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest">GDP %</th>
                    <th className="text-right p-3 text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest">Infl %</th>
                    <th className="text-right p-3 text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest">Trade</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => {
                    const state = team.roundStates?.[0];
                    const isMe = team.id === user?.teamId;
                    const openness = team.decisions?.[0]?.tradeOpenness ?? 0.5;
                    const opennessLabel = openness < 0.3 ? "Protect" : openness > 0.7 ? "Open" : "Moderate";
                    const gdp = state?.gdpGrowth;
                    const infl = state?.inflation;
                    const gdpColor = gdp !== undefined ? (gdp > 0 ? "text-[#2D8A5E]" : "text-[#C4443A]") : "text-[#6B6560]";
                    const inflColor = infl !== undefined
                      ? infl < 4 ? "text-[#2D8A5E]"
                        : infl < 8 ? "text-[#D4943A]"
                        : "text-[#C4443A]"
                      : "text-[#6B6560]";
                    return (
                      <tr
                        key={team.id}
                        className={`border-b border-[#E5E0DA]/60 transition-colors hover:bg-[#F5F2EE] ${isMe ? "bg-[#FEF3EC]" : ""}`}
                      >
                        <td className="p-3 font-medium text-[#1A1A1A]">
                          <span className="mr-1.5">{team.flagEmoji}</span>
                          <span className={isMe ? "font-semibold" : ""}>{team.name}</span>
                          {isMe && <span className="ml-1.5 text-[10px] text-[#E8792F] font-bold">YOU</span>}
                        </td>
                        <td className={`p-3 text-right font-(family-name:--font-ibm-plex-mono) text-xs tabular-nums ${gdpColor}`}>
                          {gdp !== undefined ? gdp.toFixed(1) : "—"}
                        </td>
                        <td className={`p-3 text-right font-(family-name:--font-ibm-plex-mono) text-xs tabular-nums ${inflColor}`}>
                          {infl !== undefined ? infl.toFixed(1) : "—"}
                        </td>
                        <td className="p-3 text-right text-xs capitalize text-[#6B6560]">
                          {opennessLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Relations */}
          {relations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest">Active Relations</h3>
              <div className="flex flex-wrap gap-2">
                {relations.map((rel) => {
                  const from = teams.find((t) => t.id === rel.fromTeamId);
                  const to = teams.find((t) => t.id === rel.toTeamId);
                  const isPositive = rel.type === "trade_deal" || rel.type === "alliance";
                  return (
                    <Badge
                      key={rel.id}
                      variant="secondary"
                      className={`text-xs ${isPositive ? "bg-[#2D8A5E]/10 text-[#2D8A5E]" : "bg-[#C4443A]/10 text-[#C4443A]"}`}
                    >
                      {from?.flagEmoji} ↔ {to?.flagEmoji} {rel.type.replace(/_/g, " ")}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Diplomacy Status */}
          <div className="bg-white rounded-xl p-4 border border-[#E5E0DA] shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Handshake className="h-4 w-4 text-[#1A1A1A]" />
              <h3 className="text-sm font-semibold text-[#1A1A1A] font-(family-name:--font-dm-sans)">Diplomacy Status</h3>
            </div>
            {myRelations.length > 0 ? (
              <div className="space-y-2">
                {myRelations.slice(0, 4).map((relation) => {
                  const counterpartId =
                    relation.fromTeamId === user?.teamId ? relation.toTeamId : relation.fromTeamId;
                  const counterpart = teams.find((team) => team.id === counterpartId);
                  const isPositive = relation.type === "trade_deal" || relation.type === "alliance";
                  return (
                    <div
                      key={relation.id}
                      className="flex items-center justify-between rounded-lg bg-[#F5F2EE] px-3 py-2 text-sm"
                    >
                      <span className="text-[#1A1A1A]">
                        {counterpart?.flagEmoji} {counterpart?.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`capitalize text-xs ${isPositive ? "bg-[#2D8A5E]/10 text-[#2D8A5E]" : "bg-[#C4443A]/10 text-[#C4443A]"}`}
                      >
                        {relation.type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#6B6560]">No active alliances, sanctions, or trade deals yet.</p>
            )}
          </div>
        </div>

        {/* ══ Column 3: Leaderboard, Country Passport & News ══ */}
        <div className="lg:col-span-1 space-y-5">
          {/* Desktop submitted state */}
          {game?.phase === "input" && hasSubmittedThisRound && (
            <div className="hidden lg:flex items-center gap-3 w-full bg-[#2D8A5E]/8 border border-[#2D8A5E]/30 rounded-xl p-4">
              <CheckCircle className="h-5 w-5 text-[#2D8A5E] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#2D8A5E]">Decisions Submitted</p>
                <p className="text-xs text-[#2D8A5E]/70 mt-0.5">Waiting for other teams...</p>
              </div>
            </div>
          )}

          {/* Leaderboard — only visible when results are posted for at least 1 round */}
          {game?.phase === "results" && currentRound >= 1 && (
            <div>
              <h2 className="text-xs font-semibold text-[#6B6560] uppercase tracking-widest mb-3 flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5" /> Standings
              </h2>
              <LeaderboardBars
                entries={leaderboardEntries}
                visible={game?.isLeaderboardVisible ?? true}
              />
            </div>
          )}

        </div>
      </div>

      {/* ── News Ticker ── */}
      <NewsTicker items={news} />

      {/* ── Mobile floating action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-[#E5E0DA] lg:hidden z-40 shadow-lg">
        {game?.phase === "input" && !hasSubmittedThisRound ? (
          <Button
            onClick={() => router.push("/team/decide")}
            className="w-full bg-[#E8792F] hover:bg-[#d16a25] text-white font-semibold rounded-lg h-12 text-base"
          >
            <ArrowUpCircle className="mr-2 h-5 w-5" />
            Make Decisions →
          </Button>
        ) : game?.phase === "input" && hasSubmittedThisRound ? (
          <div className="flex items-center justify-center gap-2 h-12 rounded-lg bg-[#2D8A5E]/10 border border-[#2D8A5E]/30">
            <CheckCircle className="h-5 w-5 text-[#2D8A5E]" />
            <span className="text-sm font-semibold text-[#2D8A5E]">Decisions Submitted — Waiting...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 h-12 rounded-lg bg-[#F5F2EE] border border-[#E5E0DA]">
            <span className={`w-2 h-2 rounded-full ${phaseColor} animate-pulse`} />
            <span className="text-sm text-[#6B6560] font-medium">{phaseText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
