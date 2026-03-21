"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GrainBackground } from "@/components/shared/GrainBackground";
import { Shield, Users } from "lucide-react";

interface TeamEntry { id: string; name: string; color: string; flagEmoji: string; }

export default function LoginPage() {
  const [mode, setMode] = useState<"pick" | "teams">("pick");
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/login")
      .then((r) => r.json())
      .then((data) => { if (data.teams) setTeams(data.teams); })
      .catch(() => {});
  }, []);

  const enterAs = async (role: string, teamName?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, teamName }),
      });
      if (res.ok) {
        if (role === "admin") router.push("/admin/control");
        else router.push("/team");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-4 relative">
      <GrainBackground />
      <Card className="w-full max-w-lg shadow-lg border-0 rounded-xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader className="text-center pb-2 pt-8">
          <h1 className="text-4xl font-bold text-[#1B2A4A] font-[family-name:var(--font-dm-sans)] tracking-tight">
            MACRO TRADER
          </h1>
          <p className="text-gray-500 font-[family-name:var(--font-ibm-plex-sans)] mt-1">
            The Policy Edition
          </p>
        </CardHeader>
        <CardContent className="pt-6 pb-8 px-8">
          {mode === "pick" ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-gray-500 mb-6">Choose how to enter</p>
              <Button
                onClick={() => enterAs("admin")}
                disabled={loading}
                className="w-full h-14 rounded-lg bg-[#1B2A4A] hover:bg-[#2a3d66] text-white font-semibold text-base transition-all flex items-center justify-center gap-3"
              >
                <Shield className="w-5 h-5" />
                Enter as Admin
              </Button>
              <Button
                onClick={() => setMode("teams")}
                disabled={loading}
                className="w-full h-14 rounded-lg bg-[#E8792F] hover:bg-[#d16a25] text-white font-semibold text-base transition-all flex items-center justify-center gap-3"
              >
                <Users className="w-5 h-5" />
                Enter as Team
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setMode("pick")}
                className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
              >
                &larr; Back
              </button>
              <p className="text-center text-sm text-gray-500 mb-4">Select your nation</p>
              <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
                {teams.length === 0 ? (
                  <p className="col-span-2 text-center text-sm text-gray-400 py-4">Loading teams…</p>
                ) : (
                  teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => enterAs("team", team.name)}
                      disabled={loading}
                      className="flex items-center gap-2 p-3 rounded-lg border-2 border-gray-200 hover:border-current transition-all text-left disabled:opacity-50"
                      style={{ color: team.color }}
                    >
                      <span className="text-2xl">{team.flagEmoji}</span>
                      <span className="font-semibold text-sm">{team.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 text-center mt-6">
            Episteme 2026 | Finance and Investment Cell, SRCC
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
