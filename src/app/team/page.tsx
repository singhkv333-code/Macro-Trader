"use client";

import { useAuth } from "@/hooks/useAuth";
import { useGameState } from "@/hooks/useGameState";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { ROUND_SCENARIOS } from "@/lib/constants";
import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Shield,
  Heart,
  Banknote,
  CreditCard,
  ArrowUpCircle,
  Landmark,
  Globe,
  Briefcase,
  Handshake,
  CheckCircle,
} from "lucide-react";

import { EconomyRadarChart } from "@/components/game/EconomyRadarChart";
import { LeaderboardBars } from "@/components/game/LeaderboardBars";
import { NewsTicker } from "@/components/game/NewsTicker";
import { CountryPassport } from "@/components/game/CountryPassport";
import { RoundIntroOverlay } from "@/components/game/RoundIntroOverlay";

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

function getCreditRatingStatus(rating: string): "healthy" | "warning" | "critical" {
  if (["AAA", "AA", "A"].includes(rating)) return "healthy";
  if (["BBB", "BB"].includes(rating)) return "warning";
  return "critical";
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

export default function TeamDashboard() {
  const { user } = useAuth();
  const { game, teams, news, relations, scores, previousScores } = useGameState(3000);
  const router = useRouter();

  const [showRoundIntro, setShowRoundIntro] = useState(false);

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
  const creditStatus = getCreditRatingStatus(creditRating);

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
    <div className="space-y-5 animate-fade-in pb-32 lg:pb-8">
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

      {/* ── Context bar ── */}
      <div className="bg-white border border-[#E5E0DA] border-l-4 border-l-[#E8792F] rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-[#1A1A1A] font-(family-name:--font-dm-sans)">
          Round {currentRound} of 5
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ══ Column 1: Your Economy ══ */}
        <div className="lg:col-span-1 space-y-4">
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
          <div className="grid grid-cols-2 gap-3">
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

          {/* Secondary metrics — compact, no sparklines */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Currency Index"
              value={currentState?.currencyIndex ?? 0}
              icon={DollarSign}
              delta={getDelta("currencyIndex")}
              status={getMetricStatus("currencyIndex", currentState?.currencyIndex ?? 0)}
              compact
            />
            <MetricCard
              label="Forex Reserves"
              value={currentState?.forexReserves ?? 0}
              icon={Landmark}
              delta={getDelta("forexReserves")}
              compact
            />
            <MetricCard
              label="Approval Rating"
              value={currentState?.approvalRating ?? 0}
              icon={Heart}
              delta={getDelta("approvalRating")}
              unit="%"
              status={getMetricStatus("approvalRating", currentState?.approvalRating ?? 0)}
              compact
            />
            <MetricCard
              label="Unemployment"
              value={currentState?.unemployment ?? 0}
              icon={Users}
              delta={getDelta("unemployment")}
              unit="%"
              status={getMetricStatus("unemployment", currentState?.unemployment ?? 0)}
              compact
            />
          </div>

          {/* Credit Rating card */}
          <div className="bg-white rounded-xl border border-[#E5E0DA] border-l-4 border-l-[#E5E0DA] p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest">
                Credit Rating
              </span>
              <CreditCard className="h-3.5 w-3.5 text-[#6B6560]/60" />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-3xl font-bold font-(family-name:--font-ibm-plex-mono) text-[#1A1A1A]">
                {creditRating}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${creditRatingColor[creditRating] ?? "bg-gray-100 text-gray-600"}`}
              >
                {creditStatus === "healthy" ? "Investment Grade" : creditStatus === "warning" ? "Watch" : "Speculative"}
              </span>
            </div>
          </div>

          {/* Military strength (compact) */}
          <div className="bg-white rounded-xl border border-[#E5E0DA] p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest">
                Military Strength
              </span>
              <Shield className="h-3.5 w-3.5 text-[#6B6560]/60" />
            </div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-2xl font-bold font-(family-name:--font-ibm-plex-mono) text-[#1A1A1A] tabular-nums">
                {(currentState?.militaryStrength ?? 0).toFixed(0)}
              </span>
              {getDelta("militaryStrength") !== undefined && getDelta("militaryStrength") !== 0 && (
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full mb-0.5 ${(getDelta("militaryStrength") ?? 0) > 0 ? "bg-[#2D8A5E]/10 text-[#2D8A5E]" : "bg-[#C4443A]/10 text-[#C4443A]"}`}>
                  {(getDelta("militaryStrength") ?? 0) > 0 ? "▲" : "▼"} {Math.abs(getDelta("militaryStrength") ?? 0).toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ══ Column 2: Global Intelligence ══ */}
        <div className="lg:col-span-1 space-y-4">
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
        <div className="lg:col-span-1 space-y-4">
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

          {/* Leaderboard */}
          <div>
            <h2 className="text-xs font-semibold text-[#6B6560] uppercase tracking-widest mb-3 flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5" /> Standings
            </h2>
            <LeaderboardBars
              entries={leaderboardEntries}
              visible={game?.isLeaderboardVisible ?? true}
            />
          </div>

          {/* Country Passport */}
          {profile ? (
            <CountryPassport
              flagEmoji={myTeam?.flagEmoji ?? "🌐"}
              teamName={myTeam?.name ?? ""}
              countryProfile={profile as unknown as Parameters<typeof CountryPassport>[0]["countryProfile"]}
              creditRating={creditRating}
            />
          ) : (
            <div className="bg-white rounded-xl border border-[#E5E0DA] shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{myTeam?.flagEmoji}</span>
                <div>
                  <p className="text-sm font-bold text-[#1A1A1A]">{myTeam?.name}</p>
                  <p className="text-[10px] text-[#6B6560] uppercase tracking-wider font-semibold">Nation Profile</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-[#6B6560]">Credit Rating:</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${creditRatingColor[creditRating] ?? "bg-gray-100 text-gray-600"}`}>
                  {creditRating}
                </span>
              </div>
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
