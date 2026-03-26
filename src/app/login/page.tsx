"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GrainBackground } from "@/components/shared/GrainBackground";
import { Shield, Users, Eye, EyeOff } from "lucide-react";

interface TeamEntry { id: string; name: string; color: string; flagEmoji: string; }

export default function LoginPage() {
  const [mode, setMode] = useState<"pick" | "admin" | "teams">("pick");
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [error, setError] = useState("");

  // Admin fields
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPw, setShowAdminPw] = useState(false);

  // Team fields
  const [selectedTeam, setSelectedTeam] = useState<TeamEntry | null>(null);
  const [teamPassword, setTeamPassword] = useState("");
  const [showTeamPw, setShowTeamPw] = useState(false);

  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/login")
      .then((r) => r.json())
      .then((data) => { if (data.teams) setTeams(data.teams); })
      .catch(() => {});
  }, []);

  const loginAdmin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin", username: adminUsername, password: adminPassword }),
      });
      if (res.ok) {
        router.push("/admin/control");
      } else {
        const data = await res.json();
        setError(data.error || "Invalid credentials");
      }
    } finally {
      setLoading(false);
    }
  };

  const loginTeam = async () => {
    if (!selectedTeam) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "team", teamName: selectedTeam.name, password: teamPassword }),
      });
      if (res.ok) {
        router.push("/team");
      } else {
        const data = await res.json();
        setError(data.error || "Invalid team code");
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

          {/* ── PICK MODE ── */}
          {mode === "pick" && (
            <div className="space-y-4">
              <p className="text-center text-sm text-gray-500 mb-6">Choose how to enter</p>
              <Button
                onClick={() => { setError(""); setMode("admin"); }}
                className="w-full h-14 rounded-lg bg-[#1B2A4A] hover:bg-[#2a3d66] text-white font-semibold text-base transition-all flex items-center justify-center gap-3"
              >
                <Shield className="w-5 h-5" />
                Enter as Admin
              </Button>
              <Button
                onClick={() => { setError(""); setMode("teams"); }}
                className="w-full h-14 rounded-lg bg-[#E8792F] hover:bg-[#d16a25] text-white font-semibold text-base transition-all flex items-center justify-center gap-3"
              >
                <Users className="w-5 h-5" />
                Enter as Team
              </Button>
            </div>
          )}

          {/* ── ADMIN MODE ── */}
          {mode === "admin" && (
            <div className="space-y-4">
              <button
                onClick={() => { setMode("pick"); setError(""); }}
                className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
              >
                &larr; Back
              </button>
              <p className="text-center text-sm text-gray-500 mb-4 font-semibold">Admin Login</p>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Username</label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
                  placeholder="admin"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Password</label>
                <div className="relative">
                  <input
                    type={showAdminPw ? "text" : "password"}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loginAdmin()}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPw(!showAdminPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showAdminPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-red-500 text-center">{error}</p>}

              <Button
                onClick={loginAdmin}
                disabled={loading || !adminPassword}
                className="w-full h-12 rounded-lg bg-[#1B2A4A] hover:bg-[#2a3d66] text-white font-semibold"
              >
                {loading ? "Signing in…" : "Login as Admin →"}
              </Button>
            </div>
          )}

          {/* ── TEAMS MODE ── */}
          {mode === "teams" && (
            <div className="space-y-4">
              <button
                onClick={() => { setMode("pick"); setError(""); setSelectedTeam(null); setTeamPassword(""); }}
                className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
              >
                &larr; Back
              </button>

              {!selectedTeam ? (
                <>
                  <p className="text-center text-sm text-gray-500 mb-4">Select your nation</p>
                  <div className="grid grid-cols-2 gap-3 max-h-100 overflow-y-auto pr-1">
                    {teams.length === 0 ? (
                      <p className="col-span-2 text-center text-sm text-gray-400 py-4">Loading teams…</p>
                    ) : (
                      teams.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => { setSelectedTeam(team); setError(""); }}
                          className="flex items-center gap-2 p-3 rounded-lg border-2 border-gray-200 hover:border-current transition-all text-left"
                          style={{ color: team.color }}
                        >
                          <span className="text-2xl">{team.flagEmoji}</span>
                          <span className="font-semibold text-sm">{team.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setSelectedTeam(null); setTeamPassword(""); setError(""); }}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    &larr; Change nation
                  </button>

                  <div
                    className="flex items-center gap-3 p-3 rounded-lg border-2"
                    style={{ borderColor: selectedTeam.color, color: selectedTeam.color }}
                  >
                    <span className="text-3xl">{selectedTeam.flagEmoji}</span>
                    <span className="font-bold text-base">{selectedTeam.name}</span>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Team Code</label>
                    <div className="relative">
                      <input
                        type={showTeamPw ? "text" : "password"}
                        value={teamPassword}
                        onChange={(e) => setTeamPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && loginTeam()}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2"
                        style={{ "--tw-ring-color": selectedTeam.color } as React.CSSProperties}
                        placeholder="Enter your team code"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowTeamPw(!showTeamPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showTeamPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-500 text-center">{error}</p>}

                  <Button
                    onClick={loginTeam}
                    disabled={loading || !teamPassword}
                    className="w-full h-12 rounded-lg text-white font-semibold"
                    style={{ backgroundColor: selectedTeam.color }}
                  >
                    {loading ? "Joining…" : `Join as ${selectedTeam.name} →`}
                  </Button>
                </>
              )}
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
