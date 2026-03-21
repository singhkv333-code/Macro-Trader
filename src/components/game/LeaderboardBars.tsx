"use client";

interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  flagEmoji: string;
  color: string;
  total: number;
  delta: number;
  isMe: boolean;
}

interface LeaderboardBarsProps {
  entries: LeaderboardEntry[];
  maxScore?: number;
  visible: boolean;
}

const RANK_BADGE: Record<number, string> = {
  1: "bg-yellow-400 text-yellow-900",
  2: "bg-gray-300 text-gray-800",
  3: "bg-amber-600 text-amber-100",
};

export function LeaderboardBars({ entries, maxScore, visible }: LeaderboardBarsProps) {
  if (!visible) {
    return (
      <div className="bg-[#1A1A1A] rounded-xl border border-[#333] p-6 flex flex-col items-center justify-center gap-2 min-h-[160px]">
        <span className="text-2xl">🌫</span>
        <p className="text-sm font-bold text-white tracking-wide text-center">
          CLASSIFIED
        </p>
        <p className="text-xs text-gray-400 text-center">
          Leaderboard hidden this round
        </p>
      </div>
    );
  }

  const computedMax = maxScore ?? Math.max(...entries.map((e) => e.total), 1);
  const sorted = [...entries].sort((a, b) => b.total - a.total);

  return (
    <div className="bg-white rounded-xl border border-[#E5E0DA] shadow-sm p-4 space-y-3">
      <p className="text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest">
        Leaderboard
      </p>
      {sorted.map((entry, idx) => {
        const rank = idx + 1;
        const pct = computedMax > 0 ? (entry.total / computedMax) * 100 : 0;
        const hasScore = entry.total > 0;
        const deltaPositive = entry.delta > 0;
        const deltaNeutral = entry.delta === 0;

        return (
          <div
            key={entry.teamId}
            className={`rounded-xl p-3 space-y-1.5 transition-all ${
              entry.isMe
                ? "border border-[#E8792F] bg-[#FEF3EC]"
                : "bg-[#F5F2EE]"
            }`}
          >
            <div className="flex items-center gap-2">
              {/* Rank badge */}
              <span
                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                  RANK_BADGE[rank] ?? "bg-gray-200 text-gray-600"
                }`}
              >
                {rank}
              </span>

              {/* Flag + name */}
              <span className="text-base leading-none">{entry.flagEmoji}</span>
              <span className="flex-1 text-sm font-medium text-[#1A1A1A] truncate">
                {entry.teamName}
              </span>

              {/* Score */}
              <span className="font-mono tabular-nums text-sm font-semibold text-[#1A1A1A]">
                {hasScore ? entry.total.toFixed(1) : "—"}
              </span>

              {/* Delta pill */}
              {hasScore && !deltaNeutral && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    deltaPositive
                      ? "bg-[#2D8A5E]/10 text-[#2D8A5E]"
                      : "bg-[#C4443A]/10 text-[#C4443A]"
                  }`}
                >
                  {deltaPositive ? "▲" : "▼"} {Math.abs(entry.delta).toFixed(1)}
                </span>
              )}

              {/* YOU badge */}
              {entry.isMe && (
                <span className="text-[10px] font-bold text-[#E8792F] bg-[#E8792F]/10 px-1.5 py-0.5 rounded-full">
                  YOU
                </span>
              )}
            </div>

            {/* Progress bar */}
            {hasScore ? (
              <div className="h-1.5 bg-[#E5E0DA] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: entry.color }}
                />
              </div>
            ) : (
              <div className="h-1.5 bg-[#E5E0DA] rounded-full" />
            )}
          </div>
        );
      })}

      {sorted.length === 0 && (
        <p className="text-sm text-[#6B6560] text-center py-4">
          Scores will appear after Round 1.
        </p>
      )}
    </div>
  );
}
