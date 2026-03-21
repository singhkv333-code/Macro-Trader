"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useGameState } from "@/hooks/useGameState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUND_SCENARIOS, GLOBAL_EVENT_DETAILS } from "@/lib/constants";
import {
  Play,
  StopCircle,
  Zap,
  Eye,
  Bug,
  DollarSign,
  EyeOff,
  RotateCcw,
  Check,
  Clock,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface SubmissionStatus {
  teamId: string;
  teamName: string;
  flagEmoji: string;
  submitted: boolean;
  submittedAt: string | null;
}

export default function AdminControlPage() {
  const { game, refetch } = useGameState(2000);
  const [actionLoading, setActionLoading] = useState("");
  const [submissions, setSubmissions] = useState<SubmissionStatus[]>([]);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const router = useRouter();

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch("/api/decisions/status");
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.status);
      }
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 3000);
    return () => clearInterval(interval);
  }, [fetchSubmissions]);

  // Clear status message after 5 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const handleAuthError = (status: number, msg: string) => {
    if (status === 401 || status === 403) {
      setStatusMessage({ text: msg + " — redirecting to login...", type: "error" });
      setTimeout(() => router.push("/login"), 1500);
      return true;
    }
    return false;
  };

  const advancePhase = async (targetPhase: string) => {
    setActionLoading(targetPhase);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/game/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhase }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (!handleAuthError(res.status, data.error)) {
          setStatusMessage({ text: data.error || "Failed to advance phase", type: "error" });
        }
      } else {
        setStatusMessage({ text: `Phase changed to "${targetPhase}"`, type: "success" });
        await refetch();
      }
    } catch (err) {
      console.error("Failed:", err);
      setStatusMessage({ text: "Network error", type: "error" });
    } finally {
      setActionLoading("");
    }
  };

  const runSimulation = async () => {
    setActionLoading("simulate");
    setStatusMessage(null);

    try {
      // First move to simulating phase
      const advRes = await fetch("/api/game/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhase: "simulating" }),
      });
      if (!advRes.ok) {
        const advData = await advRes.json();
        if (!handleAuthError(advRes.status, advData.error)) {
          setStatusMessage({ text: advData.error || "Cannot start simulation", type: "error" });
        }
        setActionLoading("");
        return;
      }

      // Run the simulation
      const res = await fetch("/api/simulation/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (!handleAuthError(res.status, data.error)) {
          setStatusMessage({ text: "Simulation failed: " + (data.error || "Unknown error"), type: "error" });
        }
      } else {
        setStatusMessage({ text: "Simulation complete! Results are ready.", type: "success" });
      }
      await refetch();
    } catch (err) {
      console.error("Simulation failed:", err);
      setStatusMessage({ text: "Simulation failed (network error)", type: "error" });
    } finally {
      setActionLoading("");
    }
  };

  const triggerEvent = async (eventType: string) => {
    setActionLoading(eventType);
    try {
      await fetch("/api/game/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType }),
      });
      await refetch();
    } catch (err) {
      console.error("Failed:", err);
    } finally {
      setActionLoading("");
    }
  };

  const submittedCount = submissions.filter((s) => s.submitted).length;
  const nextRound = (game?.currentRound || 0) + 1;
  const currentScenario = ROUND_SCENARIOS[game?.currentRound || 0];
  const nextScenario = ROUND_SCENARIOS[nextRound];
  const phase = game?.phase || "waiting";

  const events = [
    { type: "oil_crisis", icon: DollarSign, color: "bg-orange-600 hover:bg-orange-700", ringColor: "ring-orange-400" },
    { type: "pandemic", icon: Bug, color: "bg-red-600 hover:bg-red-700", ringColor: "ring-red-400" },
    { type: "currency_crisis", icon: DollarSign, color: "bg-yellow-600 hover:bg-yellow-700", ringColor: "ring-yellow-400" },
    { type: "fog_of_war", icon: EyeOff, color: "bg-gray-600 hover:bg-gray-700", ringColor: "ring-gray-400" },
    { type: "none", icon: RotateCcw, color: "bg-slate-600 hover:bg-slate-700", ringColor: "ring-slate-400" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-dm-sans)]">Game Control</h1>

      {/* Status Message */}
      {statusMessage && (
        <div className={`p-3 rounded-lg text-sm font-medium animate-in fade-in duration-200 ${
          statusMessage.type === "error"
            ? "bg-red-500/20 text-red-300 border border-red-500/30"
            : "bg-green-500/20 text-green-300 border border-green-500/30"
        }`}>
          {statusMessage.text}
        </div>
      )}

      {/* Current Status */}
      <Card className="bg-[#1A2A3A] border-0 rounded-xl">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-sm text-gray-400">Round</span>
              <p className="text-4xl font-bold font-mono text-[#E8792F]">{game?.currentRound || 0}</p>
            </div>
            <div>
              <span className="text-sm text-gray-400">Phase</span>
              <p className="text-2xl font-bold uppercase">{phase}</p>
            </div>
            <div>
              <span className="text-sm text-gray-400">Submissions</span>
              <p className="text-2xl font-bold font-mono">
                {submittedCount}/{submissions.length}
              </p>
            </div>
            {game?.globalEvent && (
              <div>
                <span className="text-sm text-gray-400">Active Event</span>
                <p className={`text-lg font-bold ${GLOBAL_EVENT_DETAILS[game.globalEvent]?.color || "text-red-400"}`}>
                  {GLOBAL_EVENT_DETAILS[game.globalEvent]?.label || game.globalEvent.replace("_", " ").toUpperCase()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Round Scenario Info */}
      {currentScenario && (game?.currentRound || 0) > 0 && (
        <Card className="bg-[#1A2A3A] border-0 rounded-xl border-l-4 border-l-[#E8792F]">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-[#E8792F] mt-0.5 shrink-0" />
              <div className="space-y-2">
                <h3 className="text-base font-bold text-[#E8792F]">
                  Round {game?.currentRound}: {currentScenario.title}
                </h3>
                <p className="text-sm text-gray-300">{currentScenario.description}</p>
                <div className="bg-[#0F1923] rounded-lg p-3 mt-2">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Mechanical Effects</p>
                  <p className="text-sm text-gray-200 font-mono">{currentScenario.mechanicText}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase Controls — Guided Flow */}
      <Card className="bg-[#1A2A3A] border-0 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg">Round Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Next Round Preview */}
          {nextScenario && (phase === "waiting" || phase === "results") && (
            <div className="bg-[#0F1923] rounded-lg p-3 mb-2">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Next Round Preview</p>
              <p className="text-sm font-semibold text-gray-200">
                Round {nextRound}: {nextScenario.title}
              </p>
              <p className="text-xs text-gray-400 mt-1">{nextScenario.description}</p>
            </div>
          )}

          {/* Primary action based on current phase */}
          <div className="space-y-3">
            {/* Step 1: Start Next Round (only from waiting/results) */}
            {(phase === "waiting" || phase === "results") && (game?.currentRound || 0) < 5 && (
              <Button
                onClick={() => advancePhase("input")}
                disabled={!!actionLoading}
                className="w-full h-16 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-center gap-3 text-lg"
              >
                <Play className="h-6 w-6" />
                Start Round {nextRound}
              </Button>
            )}

            {/* Step 2: During input phase — show Run Simulation */}
            {phase === "input" && (
              <Button
                onClick={runSimulation}
                disabled={!!actionLoading}
                className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-3 text-lg"
              >
                <Zap className="h-6 w-6" />
                {actionLoading === "simulate" ? "Running Simulation..." : `End Input & Run Simulation (${submittedCount}/${submissions.length} submitted)`}
              </Button>
            )}

            {/* Step 3: During simulating — show waiting */}
            {phase === "simulating" && (
              <div className="w-full h-16 bg-amber-600/20 border border-amber-500/30 rounded-xl flex items-center justify-center gap-3 text-amber-300">
                <StopCircle className="h-6 w-6 animate-pulse" />
                Simulation in progress...
              </div>
            )}

            {/* Step 4: Show Results (auto after sim, or manual) */}
            {phase === "results" && (game?.currentRound || 0) < 5 && (
              <div className="text-center text-sm text-gray-400 py-2">
                Results are live! Click &quot;Start Round {nextRound}&quot; above when ready to continue.
              </div>
            )}

            {/* Game over */}
            {(game?.currentRound || 0) >= 5 && phase === "results" && (
              <div className="text-center py-4">
                <p className="text-xl font-bold text-[#E8792F]">Game Complete!</p>
                <p className="text-sm text-gray-400 mt-1">All 5 rounds have been played. Check the dashboard for final scores.</p>
              </div>
            )}
          </div>

          {/* Warning if not all teams submitted */}
          {phase === "input" && submittedCount < submissions.length && submissions.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {submissions.length - submittedCount} team(s) haven&apos;t submitted yet.
                Running simulation will auto-submit their previous round&apos;s decisions.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Events */}
      <Card className="bg-[#1A2A3A] border-0 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Global Events
            <span className="text-xs font-normal text-gray-400">
              (set before running simulation)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {events.map((event) => {
              const details = GLOBAL_EVENT_DETAILS[event.type];
              const isActive = game?.globalEvent === event.type;
              return (
                <div key={event.type} className="space-y-1">
                  <Button
                    onClick={() => {
                      if (event.type === "none") {
                        triggerEvent("none");
                      } else if (expandedEvent === event.type) {
                        triggerEvent(event.type);
                        setExpandedEvent(null);
                      } else {
                        setExpandedEvent(event.type);
                      }
                    }}
                    disabled={!!actionLoading}
                    className={`h-14 w-full ${event.color} text-white rounded-xl flex items-center gap-2 ${
                      isActive ? `ring-2 ${event.ringColor}` : ""
                    }`}
                  >
                    <event.icon className="h-4 w-4" />
                    <span className="text-xs">
                      {details?.label || "Clear Events"}
                    </span>
                    {isActive && <Check className="h-3 w-3" />}
                    {details && !isActive && (
                      expandedEvent === event.type
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Expanded event details */}
          {expandedEvent && GLOBAL_EVENT_DETAILS[expandedEvent] && (
            <div className="bg-[#0F1923] rounded-lg p-4 space-y-2 animate-in fade-in duration-200">
              <h4 className={`text-sm font-bold ${GLOBAL_EVENT_DETAILS[expandedEvent].color}`}>
                {GLOBAL_EVENT_DETAILS[expandedEvent].label}
              </h4>
              <p className="text-sm text-gray-300">{GLOBAL_EVENT_DETAILS[expandedEvent].description}</p>
              <div className="bg-[#1A2A3A] rounded-md p-2">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Effects</p>
                <p className="text-xs text-gray-200 font-mono">{GLOBAL_EVENT_DETAILS[expandedEvent].mechanicText}</p>
              </div>
              <Button
                onClick={() => {
                  triggerEvent(expandedEvent);
                  setExpandedEvent(null);
                }}
                disabled={!!actionLoading}
                className="w-full mt-2 bg-[#E8792F] hover:bg-[#d16a25] text-white rounded-lg text-sm h-9"
              >
                Activate {GLOBAL_EVENT_DETAILS[expandedEvent].label}
              </Button>
            </div>
          )}

          {/* Currently active event details */}
          {game?.globalEvent && GLOBAL_EVENT_DETAILS[game.globalEvent] && !expandedEvent && (
            <div className="bg-[#0F1923] rounded-lg p-3 border border-red-500/20">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span className="text-xs font-semibold text-red-400 uppercase">Active Event</span>
              </div>
              <p className="text-sm text-gray-200">{GLOBAL_EVENT_DETAILS[game.globalEvent].description}</p>
              <p className="text-xs text-gray-400 font-mono mt-1">{GLOBAL_EVENT_DETAILS[game.globalEvent].mechanicText}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Submission Status */}
      <Card className="bg-[#1A2A3A] border-0 rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg">Team Submissions — Round {game?.currentRound || 0}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {submissions.map((team) => (
              <div
                key={team.teamId}
                className={`p-3 rounded-xl border ${
                  team.submitted ? "border-green-500/30 bg-green-500/10" : "border-amber-500/30 bg-amber-500/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{team.flagEmoji}</span>
                  <span className="text-sm font-medium truncate">{team.teamName}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {team.submitted ? (
                    <>
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-green-400">Submitted</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
                      <span className="text-xs text-amber-400">Pending</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Controls */}
      <Card className="bg-[#1A2A3A] border-0 rounded-xl border-red-500/20">
        <CardHeader>
          <CardTitle className="text-lg text-red-400">Emergency Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => advancePhase("waiting")}
              disabled={!!actionLoading}
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl"
            >
              Pause Game
            </Button>
            <Button
              onClick={() => advancePhase("results")}
              disabled={!!actionLoading}
              variant="outline"
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-xl"
            >
              Force to Results
            </Button>
            <Button
              onClick={() => advancePhase("input")}
              disabled={!!actionLoading}
              variant="outline"
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-xl"
            >
              Force Next Round
            </Button>
            <Button
              onClick={async () => {
                if (!confirm("Are you sure? This will DELETE all rounds, decisions, and scores. The game will restart from Round 0.")) return;
                setActionLoading("reset");
                try {
                  const res = await fetch("/api/game/reset", { method: "POST" });
                  const data = await res.json();
                  if (res.ok) {
                    setStatusMessage({ text: "Game reset to Round 0", type: "success" });
                  } else {
                    setStatusMessage({ text: data.error || "Reset failed", type: "error" });
                  }
                  await refetch();
                } catch {
                  setStatusMessage({ text: "Reset failed (network error)", type: "error" });
                } finally {
                  setActionLoading("");
                }
              }}
              disabled={!!actionLoading}
              variant="outline"
              className="border-red-600/50 text-red-500 hover:bg-red-500/10 rounded-xl"
            >
              Reset Game
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Use &quot;Force to Results&quot; if the game is stuck in simulating phase.
            &quot;Force Next Round&quot; skips to the next round&apos;s input phase.
            &quot;Reset Game&quot; wipes all progress and restarts from Round 0.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
