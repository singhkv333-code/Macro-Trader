"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface TeamData {
  id: string;
  name: string;
  color: string;
  flagEmoji: string;
  roundStates: Array<{
    round: number;
    gdpGrowth: number;
  }>;
}

interface GDPChartProps {
  teams: TeamData[];
  currentRound: number;
}

export default function GDPChart({ teams, currentRound }: GDPChartProps) {
  if (currentRound === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
        No data yet — game hasn&apos;t started
      </div>
    );
  }

  // Build chart data: one entry per round
  const rounds = Array.from({ length: currentRound + 1 }, (_, i) => i);
  const chartData = rounds.map((round) => {
    const entry: Record<string, number | string> = { round: `R${round}` };
    teams.forEach((team) => {
      const state = team.roundStates.find((s) => s.round === round);
      entry[team.name] = state?.gdpGrowth ?? 0;
    });
    return entry;
  });

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="round" stroke="#666" tick={{ fill: "#888", fontSize: 12 }} />
          <YAxis stroke="#666" tick={{ fill: "#888", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1A2A3A",
              border: "1px solid #ffffff20",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "12px",
            }}
          />
          {teams.map((team) => (
            <Line
              key={team.id}
              type="monotone"
              dataKey={team.name}
              stroke={team.color}
              strokeWidth={2}
              dot={{ fill: team.color, r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
