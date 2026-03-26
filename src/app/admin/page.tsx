"use client";

import { useGameState } from "@/hooks/useGameState";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import { TrendingUp, Trophy } from "lucide-react";

const GDPChart = dynamic(() => import("@/components/admin/GDPChart"), { ssr: false });

export default function AdminDashboard() {
  const { game, teams, news, scores, previousScores, loading } = useGameState(2000);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 animate-pulse text-lg">Loading dashboard...</div>
      </div>
    );
  }

  const phaseLabel: Record<string, string> = {
    waiting: "WAITING",
    input: "DECISIONS OPEN",
    simulating: "SIMULATING",
    results: "RESULTS",
  };

  const previousScoreByTeam = previousScores.reduce<Record<string, number>>((acc, score) => {
    acc[score.teamId] = score.total;
    return acc;
  }, {});

  const rankedTeams = scores.length
    ? scores.map((score) => {
        const team = teams.find((entry) => entry.id === score.teamId);
        const previous = previousScoreByTeam[score.teamId] ?? score.total;
        return { ...score, team, delta: score.total - previous };
      })
    : teams
        .map((team) => {
          const state = team.roundStates?.[0];
          const total = state
            ? state.gdpGrowth * 2 + (10 - state.unemployment) + state.approvalRating / 10 + state.trustScore / 10
            : 0;
          return { teamId: team.id, total, breakdown: {}, team, delta: 0 };
        })
        .sort((a, b) => b.total - a.total);

  const showFinalResults = game?.phase === "results" && (game?.currentRound ?? 0) >= 4;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wider font-[family-name:var(--font-dm-sans)]">
          LIVE DASHBOARD
        </h1>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-[#E8792F] border-[#E8792F]/30 text-sm px-3 py-1">
            Round {game?.currentRound || 0}
          </Badge>
          <Badge
            variant="outline"
            className={`text-sm px-3 py-1 ${
              game?.phase === "input"
                ? "text-green-400 border-green-400/30"
                : game?.phase === "results"
                ? "text-blue-400 border-blue-400/30"
                : "text-amber-400 border-amber-400/30"
            }`}
          >
            {phaseLabel[game?.phase || "waiting"]}
          </Badge>
          {game?.globalEvent && (
            <Badge variant="destructive" className="text-sm px-3 py-1 animate-pulse">
              EVENT: {game.globalEvent.replace("_", " ").toUpperCase()}
            </Badge>
          )}
        </div>
      </div>

      {/* Nation Health Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {teams.map((team) => {
          const state = team.roundStates?.[0];
          const isFog = game?.globalEvent === "fog_of_war";
          return (
            <div
              key={team.id}
              className="bg-[#1A2A3A] rounded-xl p-4 border-l-4 transition-all hover:bg-[#1f3347]"
              style={{ borderLeftColor: team.color }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{team.flagEmoji}</span>
                <span className="font-semibold text-sm truncate">{team.name}</span>
              </div>
              {isFog ? (
                <div className="text-center text-gray-500 py-2 font-mono">???</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">GDP</span>
                    <p className={`font-mono font-bold ${(state?.gdpGrowth ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {state?.gdpGrowth?.toFixed(1) ?? "—"}%
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Inflation</span>
                    <p className={`font-mono font-bold ${(state?.inflation ?? 4) <= 6 ? "text-green-400" : (state?.inflation ?? 4) <= 10 ? "text-amber-400" : "text-red-400"}`}>
                      {state?.inflation?.toFixed(1) ?? "—"}%
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Deficit</span>
                    <p className={`font-mono font-bold ${(state?.fiscalDeficit ?? 0) <= 3 ? "text-green-400" : (state?.fiscalDeficit ?? 0) <= 6 ? "text-amber-400" : "text-red-400"}`}>
                      {state?.fiscalDeficit?.toFixed(1) ?? "—"}%
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Trade</span>
                    {(() => {
                      const tb = (state as unknown as Record<string, number>)?.tradeBalance;
                      return (
                        <p className={`font-mono font-bold ${(tb ?? 0) >= 0 ? "text-green-400" : "text-amber-400"}`}>
                          {tb !== undefined ? (tb >= 0 ? "+" : "") + tb.toFixed(0) : "—"}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Charts and News Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="bg-[#1A2A3A] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Leaderboard</h2>
          {!game?.isLeaderboardVisible ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-bold">HIDDEN</p>
              <p className="text-xs mt-2">Leaderboard visibility is turned off</p>
            </div>
          ) : game?.globalEvent === "fog_of_war" ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-bold">CLASSIFIED</p>
              <p className="text-xs mt-2">Fog of war is active</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rankedTeams.map((entry, i) => (
                  <div key={entry.teamId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? "bg-yellow-500 text-black" : i === 1 ? "bg-gray-300 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-gray-700 text-gray-300"
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-sm">{entry.team?.flagEmoji}</span>
                    <span className="text-sm font-medium flex-1">{entry.team?.name}</span>
                    <div className="text-right">
                      <span className="font-mono text-sm text-[#E8792F]">{entry.total.toFixed(1)}</span>
                      <p className={`text-[10px] ${entry.delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {entry.delta >= 0 ? "+" : ""}
                        {entry.delta.toFixed(1)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* GDP Chart */}
        <div className="bg-[#1A2A3A] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">GDP Growth Trends</h2>
          <GDPChart teams={teams} currentRound={game?.currentRound || 0} />
        </div>

        {/* News Feed */}
        <div className="bg-[#1A2A3A] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">News Feed</h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {news.map((item) => {
              const typeColor: Record<string, string> = {
                conflict: "text-red-400 border-l-red-500",
                trade: "text-green-400 border-l-green-500",
                crisis: "text-amber-400 border-l-amber-500",
                alliance: "text-blue-400 border-l-blue-500",
                economic: "text-teal-400 border-l-teal-500",
              };
              return (
                <div
                  key={item.id}
                  className={`border-l-2 pl-3 py-1.5 ${typeColor[item.type] || "text-gray-400 border-l-gray-600"}`}
                >
                  <p className="text-sm">{item.headline}</p>
                  <span className="text-xs text-gray-600">Round {item.round}</span>
                </div>
              );
            })}
            {news.length === 0 && (
              <p className="text-sm text-gray-600 text-center py-8">No news yet</p>
            )}
          </div>
        </div>
      </div>

      {showFinalResults && (
        <div className="bg-[#1A2A3A] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-[#E8792F]" />
            <h2 className="text-lg font-semibold">Final Results</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rankedTeams.slice(0, 6).map((entry, index) => (
              <div key={entry.teamId} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500">Rank #{index + 1}</p>
                    <h3 className="mt-1 text-lg font-semibold">
                      {entry.team?.flagEmoji} {entry.team?.name}
                    </h3>
                  </div>
                  <span className="font-mono text-2xl text-[#E8792F]">{entry.total.toFixed(1)}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <div className="rounded-lg bg-black/10 p-2">
                    GDP
                    <p className="mt-1 font-mono text-white">{((entry.breakdown as Record<string, number>).cumulativeGDP ?? 0).toFixed(1)}</p>
                  </div>
                  <div className="rounded-lg bg-black/10 p-2">
                    Inflation
                    <p className="mt-1 font-mono text-white">{((entry.breakdown as Record<string, number>).inflationStability ?? 0).toFixed(1)}</p>
                  </div>
                  <div className="rounded-lg bg-black/10 p-2">
                    Trade
                    <p className="mt-1 font-mono text-white">{((entry.breakdown as Record<string, number>).tradeBalance ?? 0).toFixed(1)}</p>
                  </div>
                  <div className="rounded-lg bg-black/10 p-2">
                    Diplomacy
                    <p className="mt-1 font-mono text-white">{((entry.breakdown as Record<string, number>).diplomaticScore ?? 0).toFixed(1)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <TrendingUp className="h-4 w-4" />
            Composite scores now use the weighted simulation rubric from `Claude.md`.
          </div>
        </div>
      )}
    </div>
  );
}
