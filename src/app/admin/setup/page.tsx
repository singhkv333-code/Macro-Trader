"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Users } from "lucide-react";

interface Team {
  id: string;
  name: string;
  color: string;
  flagEmoji: string;
  users: { id: string; username: string }[];
}

export default function AdminSetupPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeam, setNewTeam] = useState({ name: "", color: "#2E75B6", flagEmoji: "", username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

  const fetchTeams = useCallback(async () => {
    const res = await fetch("/api/teams");
    if (res.ok) {
      const data = await res.json();
      setTeams(data.teams);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const addTeam = async () => {
    if (!newTeam.name) return;
    setLoading(true);
    try {
      await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTeam),
      });
      setNewTeam({ name: "", color: "#2E75B6", flagEmoji: "", username: "", password: "" });
      await fetchTeams();
    } catch (err) {
      console.error("Failed to add team:", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm("Delete this team and all its data?")) return;
    try {
      await fetch("/api/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      await fetchTeams();
    } catch (err) {
      console.error("Failed to delete team:", err);
    }
  };

  const seedGame = async () => {
    if (!confirm("This will reset the game and create default teams. Continue?")) return;
    setSeedLoading(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        await fetchTeams();
        alert("Game seeded successfully!");
      } else {
        const data = await res.json();
        alert("Seed failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Seed failed:", err);
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-dm-sans)]">Game Setup</h1>

      {/* Quick Seed */}
      <Card className="bg-[#1A2A3A] border-0 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg">Quick Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={seedGame}
            disabled={seedLoading}
            className="bg-[#E8792F] hover:bg-[#d16a25] text-white rounded-xl h-12 px-8"
          >
            {seedLoading ? "Seeding..." : "Seed Default Teams & Users"}
          </Button>
          <p className="text-xs text-gray-500 mt-2">Creates 15 teams with default users and initializes the game</p>
        </CardContent>
      </Card>

      {/* Add Team */}
      <Card className="bg-[#1A2A3A] border-0 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Plus className="h-5 w-5" /> Add Team</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-400 text-sm">Team Name</Label>
              <Input
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                className="bg-[#0F1923] border-white/10 text-white rounded-lg mt-1"
                placeholder="e.g. Bharat"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-sm">Emoji</Label>
              <Input
                value={newTeam.flagEmoji}
                onChange={(e) => setNewTeam({ ...newTeam, flagEmoji: e.target.value })}
                className="bg-[#0F1923] border-white/10 text-white rounded-lg mt-1"
                placeholder="e.g. 🇮🇳"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-sm">Color</Label>
              <div className="flex gap-2 mt-1">
                <input
                  type="color"
                  value={newTeam.color}
                  onChange={(e) => setNewTeam({ ...newTeam, color: e.target.value })}
                  className="w-10 h-10 rounded-lg cursor-pointer"
                />
                <Input
                  value={newTeam.color}
                  onChange={(e) => setNewTeam({ ...newTeam, color: e.target.value })}
                  className="bg-[#0F1923] border-white/10 text-white rounded-lg font-mono"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400 text-sm">Username</Label>
              <Input
                value={newTeam.username}
                onChange={(e) => setNewTeam({ ...newTeam, username: e.target.value })}
                className="bg-[#0F1923] border-white/10 text-white rounded-lg mt-1"
                placeholder="e.g. bharat1"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-sm">Password</Label>
              <Input
                value={newTeam.password}
                onChange={(e) => setNewTeam({ ...newTeam, password: e.target.value })}
                className="bg-[#0F1923] border-white/10 text-white rounded-lg mt-1"
                placeholder="e.g. bharat123"
              />
            </div>
          </div>
          <Button
            onClick={addTeam}
            disabled={loading || !newTeam.name}
            className="mt-4 bg-green-600 hover:bg-green-700 text-white rounded-xl"
          >
            {loading ? "Adding..." : "Add Team"}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Teams */}
      <Card className="bg-[#1A2A3A] border-0 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Teams ({teams.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#0F1923] border-l-4"
                style={{ borderLeftColor: team.color }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{team.flagEmoji}</span>
                  <div>
                    <p className="font-semibold">{team.name}</p>
                    <p className="text-xs text-gray-500">
                      Users: {team.users.map((u) => u.username).join(", ") || "none"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTeam(team.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {teams.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">No teams yet. Use &quot;Seed Default Teams&quot; above or add manually.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
