"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useGameState } from "@/hooks/useGameState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Landmark, Percent, Building, Banknote, Globe,
  Handshake, Swords, AlertTriangle, ArrowLeft, Check,
  Zap, Package, TrendingUp, TrendingDown,
} from "lucide-react";
import {
  ROUND_SCENARIOS,
  COMMODITY_LABELS,
  COMMODITY_BASE_PRICES,
  DECISION_LIMITS,
} from "@/lib/constants";
import { calculateGDPGrowth, calculateInflation } from "@/lib/simulation/formulas";
import { ObjectiveCard } from "@/components/game/ObjectiveCard";

// ── Types ────────────────────────────────────────────────────────────────────

const COMMODITIES = ["oil", "metals", "food", "semis", "pharma", "textiles"] as const;
type Commodity = typeof COMMODITIES[number];

const COMMODITY_EMOJIS: Record<Commodity, string> = {
  oil:      "🛢",
  metals:   "⛏",
  food:     "🌾",
  semis:    "💾",
  pharma:   "💊",
  textiles: "👕",
};

interface DiploOption {
  value: string;
  label: string;
  icon: string;
  desc: string;
  color: "gray" | "green" | "blue" | "red";
  requiresTrade?: boolean;
  requiresConflict?: boolean;
}

const DIPLO_OPTIONS: DiploOption[] = [
  { value: "none",            label: "No Action",          icon: "—",  desc: "Stay neutral",                              color: "gray"  },
  { value: "trade_deal",      label: "Trade Deal",         icon: "🤝", desc: "+GDP for both nations",                     color: "green" },
  { value: "alliance",        label: "Alliance",           icon: "🛡", desc: "Military pact — mutual defense",             color: "blue"  },
  { value: "break_alliance",  label: "Break Alliance",     icon: "💔", desc: "End an alliance (−6 diplomacy pts)",         color: "red"   },
  { value: "cancel_deal",     label: "Cancel Trade Deal",  icon: "🚫", desc: "End a trade deal (−4 diplomacy pts)",        color: "red"   },
  { value: "sanctions",       label: "Sanctions",          icon: "⚔️", desc: "Target −1% GDP, you −0.3%",                  color: "red",  requiresTrade: true },
  { value: "trade_war",       label: "Trade War",          icon: "💥", desc: "Both −0.8% GDP",                            color: "red",  requiresTrade: true },
  { value: "conflict",        label: "Military Conflict",  icon: "🎯", desc: "High risk/reward combat",                   color: "red",  requiresConflict: true },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function signedArrow(val: number, positiveIsGood = true): string {
  if (val === 0) return "→";
  if (val > 0) return positiveIsGood ? "↑" : "↓";
  return positiveIsGood ? "↓" : "↑";
}

function impactColor(val: number, positiveIsGood = true): string {
  if (val === 0) return "text-[#6B6560]";
  const beneficial = positiveIsGood ? val > 0 : val < 0;
  return beneficial ? "text-[#2D8A5E]" : "text-[#C4443A]";
}

function fmtDelta(val: number): string {
  if (val === 0) return "0.0";
  return (val > 0 ? "+" : "") + val.toFixed(2);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DecidePage() {
  const { user }        = useAuth();
  const { game, teams } = useGameState(5000);
  const router          = useRouter();

  // ── Core policy sliders ──────────────────────────────────────────────────
  const [interestRate,    setInterestRate]    = useState(5.0);
  const [taxRate,         setTaxRate]         = useState(20);
  const [infraSpending,   setInfraSpending]   = useState(34);
  const [subsidySpending, setSubsidySpending] = useState(33);
  const [defenseSpending, setDefenseSpending] = useState(33);
  const [borrowing,       setBorrowing]       = useState(0);
  const [tradeOpenness,   setTradeOpenness]   = useState(0.5);

  // ── Commodity trade orders ───────────────────────────────────────────────
  const [exports, setExports] = useState<Record<Commodity, number>>({
    oil: 0, metals: 0, food: 0, semis: 0, pharma: 0, textiles: 0,
  });
  const [imports, setImports] = useState<Record<Commodity, number>>({
    oil: 0, metals: 0, food: 0, semis: 0, pharma: 0, textiles: 0,
  });

  // ── Diplomacy ────────────────────────────────────────────────────────────
  const [diplomaticAction, setDiplomaticAction] = useState("none");
  const [diplomaticTarget, setDiplomaticTarget] = useState("");
  const [usePowerUp,       setUsePowerUp]       = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const myTeam      = teams.find(t => t.id === user?.teamId);
  const otherTeams  = teams.filter(t => t.id !== user?.teamId);
  const currentState = (myTeam as any)?.roundStates?.[0];
  const currentRound = game?.currentRound ?? 1;
  const scenario     = ROUND_SCENARIOS[currentRound];
  const tradeEnabled = scenario?.tradeEnabled ?? false;
  const conflictsEnabled = scenario?.conflictsEnabled ?? false;

  // ── Budget auto-balance ──────────────────────────────────────────────────
  const adjustBudget = (changed: "infra" | "subsidy" | "defense", newVal: number) => {
    const remaining = 100 - newVal;
    if (changed === "infra") {
      const ratio = (subsidySpending + defenseSpending) > 0
        ? subsidySpending / (subsidySpending + defenseSpending) : 0.5;
      setInfraSpending(newVal);
      setSubsidySpending(Math.round(remaining * ratio));
      setDefenseSpending(Math.round(remaining * (1 - ratio)));
    } else if (changed === "subsidy") {
      const ratio = (infraSpending + defenseSpending) > 0
        ? infraSpending / (infraSpending + defenseSpending) : 0.5;
      setSubsidySpending(newVal);
      setInfraSpending(Math.round(remaining * ratio));
      setDefenseSpending(Math.round(remaining * (1 - ratio)));
    } else {
      const ratio = (infraSpending + subsidySpending) > 0
        ? infraSpending / (infraSpending + subsidySpending) : 0.5;
      setDefenseSpending(newVal);
      setInfraSpending(Math.round(remaining * ratio));
      setSubsidySpending(Math.round(remaining * (1 - ratio)));
    }
  };

  useEffect(() => {
    const sum = infraSpending + subsidySpending + defenseSpending;
    if (sum !== 100) setDefenseSpending(defenseSpending + (100 - sum));
  }, [infraSpending, subsidySpending, defenseSpending]);

  // ── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const decRes = await fetch("/api/decisions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interestRate, taxRate, infraSpending, subsidySpending, defenseSpending,
          borrowing, tradeOpenness,
          diplomaticAction,
          diplomaticTarget: diplomaticAction !== "none" ? diplomaticTarget : null,
          usePowerUp,
        }),
      });
      if (!decRes.ok) {
        const data = await decRes.json();
        alert((data.error || "Failed to submit decisions") + (data.detail ? `\n\n${data.detail}` : ""));
        return;
      }

      if (tradeEnabled) {
        const orders: Array<{ commodity: string; direction: string; quantity: number }> = [];
        for (const c of COMMODITIES) {
          if (exports[c] > 0) orders.push({ commodity: c, direction: "export", quantity: exports[c] });
          if (imports[c] > 0) orders.push({ commodity: c, direction: "import", quantity: imports[c] });
        }
        if (orders.length > 0) {
          await fetch("/api/trade/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orders }),
          });
        }
      }

      setSubmitted(true);
      setTimeout(() => router.push("/team"), 2000);
    } catch {
      alert("Failed to submit decisions. Please try again.");
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  // ── Guard views ──────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-[#1B2A4A] mb-2">Decisions Submitted!</h2>
        <p className="text-[#6B6560]">Waiting for other teams to submit...</p>
      </div>
    );
  }

  const latestDecision = (myTeam as any)?.decisions?.[0];
  const alreadySubmitted = latestDecision && latestDecision.round === currentRound;

  if (alreadySubmitted) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-[#1B2A4A] mb-2">Already Submitted</h2>
        <p className="text-[#6B6560] mb-4">Your decisions for Round {currentRound} are locked in.</p>
        <Button variant="outline" onClick={() => router.push("/team")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  if (game?.phase !== "input") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <h2 className="text-xl font-bold text-[#1B2A4A] mb-2">Not accepting decisions right now</h2>
        <p className="text-[#6B6560] mb-4">Wait for the admin to open the input phase.</p>
        <Button variant="outline" onClick={() => router.push("/team")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  // ── Derived values for live previews ────────────────────────────────────

  // profile must be declared first — used throughout live preview calculations
  const profile        = (myTeam as any)?.countryProfile;
  const powerUpUsed    = !!profile?.powerUpUsed;
  const powerUpName    = profile?.powerUpName    ?? "Economic Stimulus";
  const powerUpDesc    = profile?.powerUpDescription ?? "Boost GDP this round.";

  // Declare all prof* scalars before any formula that needs them
  const profA    = (profile?.productivityFactor as number) ?? 1.0;
  const profGPot = (profile?.potentialGrowth   as number) ?? 3.0;
  const profRN   = (profile?.rNeutral          as number) ?? (profGPot + 2.0);
  const profMu   = (profile?.monetaryPower     as number) ?? 1.0;

  const gdp = currentState?.gdp ?? (profile?.startingGdpBillions as number ?? 1000);

  // cumulativeDebt is stored as a percentage-of-GDP (e.g. 82 for 82%), NOT absolute dollars.
  // Dividing by gdp would give a nonsensically small number — use it directly as %.
  const prevDebtPct = (currentState as any)?.cumulativeDebt ?? (profile?.startingDebtToGdp as number ?? 0) * 100;
  const newDebt = prevDebtPct + borrowing;   // e.g. 82 + 3 = 85%

  // ── Budget projection matching engine formula exactly ───────────────────
  const profTaxEff    = (profile?.taxEfficiency as number)  ?? 0.8;
  const profSpread    = (profile?.creditSpread  as number)  ?? 0.02;
  const budRevenue    = gdp * (taxRate / 100) * profTaxEff;
  const budDebtSvc    = (prevDebtPct / 100) * gdp * (0.02 + profSpread);
  const budNetBudget  = Math.max(0, budRevenue - budDebtSvc);
  const budBorrowed   = (borrowing / 100) * gdp;
  const totalBudget   = budNetBudget + budBorrowed;

  // Fiscal deficit from budget constraint (matching calculateFiscalDeficit)
  const projTotalSpend = totalBudget;  // spending sliders sum to 100% of budget
  const projDeficit = ((projTotalSpend + budDebtSvc - budRevenue - budBorrowed) / Math.max(gdp, 1)) * 100;
  // ≈ -tradeIncome/gdp*100 (near zero when balanced; negative = surplus if trade income exists)

  // Review page deltas — kept as simple deltas vs neutral baseline for readability
  const irGdpImpact      = (profRN - interestRate) * 0.3;   // below neutral → positive
  const irInflImpact     = profMu * (interestRate - profRN) * 0.5;  // rate hike → lower inflation
  const irFxImpact       = 0.6 * (interestRate - profRN);            // rate hike → stronger currency
  const taxGdpImpact     = (taxRate - 20) * -0.08;
  const infraGdpImpact   = (infraSpending / 10) * 0.3;
  const defenseGdpImpact = (defenseSpending / 10) * -0.1;
  const estGdpImpact     = irGdpImpact + taxGdpImpact + infraGdpImpact + defenseGdpImpact;
  const estInflImpact    = (profRN - interestRate) * 0.5 + (subsidySpending / 10) * 0.1;

  const interestLabel =
    interestRate < 4.5 ? "Stimulative" :
    interestRate > 5.5 ? "Restrictive"  : "Neutral";

  const interestLabelColor =
    interestRate < 4.5 ? "text-[#2D8A5E]" :
    interestRate > 5.5 ? "text-[#C4443A]"  : "text-[#6B6560]";

  const isAggressive = ["sanctions", "trade_war", "conflict"].includes(diplomaticAction);

  const opennessLabel = tradeOpenness < 0.3 ? "Protectionist" : tradeOpenness > 0.7 ? "Open" : "Moderate";

  // ── Live projections — call the EXACT same engine functions ────────────────
  const prevInflation = currentState?.inflation ?? (profile?.startingInflation as number ?? 4.0);
  const prevGdpGrowth = currentState?.gdpGrowth ?? (profile?.startingGdpGrowth as number ?? 3.0);
  const debtToGdp     = prevDebtPct / 100;

  const engineMultipliers = {
    productivityFactor: profA,
    tradeMultiplier:    (profile?.tradeMultiplier    as number) ?? 1.0,
    monetaryPower:      profMu,
    taxEfficiency:      profTaxEff,
    potentialGrowth:    profGPot,
    creditSpread:       profSpread,
    startingDebtToGdp:  (profile?.startingDebtToGdp as number) ?? 0.5,
    rNeutral:           profRN,
  };

  // Round 1 has no trade — engine uses { _baseline: 5 } to avoid resource penalty
  const projImports = currentRound <= 1 ? { _baseline: 5 } : { _baseline: 5 };

  const projGDPRaw = calculateGDPGrowth({
    infraSpendingPct:   infraSpending,
    infraSpendBillions: (infraSpending / 100) * totalBudget,
    gdpBillions:        gdp,
    netExportsOverGDP:  0,   // no trade orders placed yet — conservative estimate
    interestRate,
    debtToGdp,
    borrowingPct:       borrowing / 100,
    taxRatePct:         taxRate / 100,
    imports:            projImports,
    countryName:        myTeam?.name ?? "",
    multipliers:        engineMultipliers,
    baseGDPGrowth:      prevGdpGrowth,
  });

  // Engine applies 30% inertia for rounds > 1
  const projGDP = currentRound <= 1
    ? projGDPRaw
    : 0.3 * prevGdpGrowth + 0.7 * projGDPRaw;

  const projInflation = calculateInflation({
    prevInflation,
    gdpGrowth:        projGDP,
    interestRate,
    debtToGdp,
    importFraction:   0,
    fxRateChange:     0,
    budgetDeficitPct: Math.max(0, projDeficit),
    multipliers:      engineMultipliers,
  });

  // Derived metrics for ObjectiveCard
  const currencyIndex = (currentState as any)?.currencyIndex ?? 100;
  const fxStability = Math.max(0, 1 - Math.abs(currencyIndex - 100) / 20);
  const diplomacyScore = (currentState as any)?.diplomacyScore ?? 0;

  // ── Steps definition ─────────────────────────────────────────────────────

  const stepCompletedMap = [
    true,                // Monetary — always fillable
    true,                // Fiscal
    tradeEnabled,        // Trade
    true,                // Diplomacy
    true,                // Review
  ];

  const steps = [
    { label: "Monetary",  locked: false },
    { label: "Fiscal",    locked: false },
    { label: "Trade",     locked: !tradeEnabled },
    { label: "Diplomacy", locked: false },
    { label: "Review",    locked: false },
  ];

  const canGoNext = currentStep < steps.length - 1;
  const canGoPrev = currentStep > 0;

  const goNext = () => {
    let next = currentStep + 1;
    while (next < steps.length - 1 && steps[next].locked) next++;
    setCurrentStep(next);
  };

  const goPrev = () => {
    let prev = currentStep - 1;
    while (prev > 0 && steps[prev].locked) prev--;
    setCurrentStep(prev);
  };

  // ── LiveMetricsBar — persistent outcome preview shown on Steps 0–3 ──────
  const LiveMetricsBar = () => {
    const gdpColor =
      projGDP > 2 ? "text-[#2D8A5E]" :
      projGDP >= 0 ? "text-[#D4943A]" : "text-[#C4443A]";
    const inflColor =
      (projInflation >= 2 && projInflation <= 4) ? "text-[#2D8A5E]" :
      projInflation <= 7 ? "text-[#D4943A]" : "text-[#C4443A]";
    const defColor =
      projDeficit < 3 ? "text-[#2D8A5E]" :
      projDeficit <= 6 ? "text-[#D4943A]" : "text-[#C4443A]";
    const debtColor =
      newDebt < 60 ? "text-[#2D8A5E]" :
      newDebt <= 90 ? "text-[#D4943A]" : "text-[#C4443A]";
    return (
      <div className="bg-[#1B2A4A] rounded-xl px-4 py-3 mt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest">Live Outcome Preview</p>
          <p className="text-[10px] text-white/40 italic">updates as you adjust</p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "GDP Growth",      val: `${projGDP >= 0 ? "+" : ""}${projGDP.toFixed(1)}%`,   color: gdpColor  },
            { label: "Inflation",       val: `${projInflation.toFixed(1)}%`,                         color: inflColor },
            { label: "Fiscal Deficit",  val: `${projDeficit >= 0 ? "+" : ""}${projDeficit.toFixed(1)}%`, color: defColor },
            { label: "Debt / GDP",      val: `${newDebt.toFixed(1)}%`,                               color: debtColor },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-white/5 rounded-lg py-2 px-1">
              <p className="text-[9px] text-white/50 uppercase tracking-wider font-semibold mb-1">{label}</p>
              <p className={`text-sm font-mono font-bold ${color}`}>{val}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="max-w-6xl mx-auto pb-10 animate-fade-in"
      style={{ background: "transparent" }}
    >
      {/* Page header */}
      <div className="flex items-center gap-3 mb-5">
        <Button variant="ghost" size="sm" onClick={() => router.push("/team")} className="p-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-[#1A1A1A]" style={{ fontFamily: "DM Sans, sans-serif" }}>
            Round {currentRound} Decisions
          </h1>
          {scenario && <p className="text-xs text-[#6B6560]">{scenario.title} — {scenario.mechanicText}</p>}
        </div>
      </div>

      {/* Stepper header */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
        {steps.map((step, i) => {
          const isActive    = currentStep === i;
          const isCompleted = i < currentStep && !step.locked;
          return (
            <button
              key={i}
              onClick={() => !step.locked && setCurrentStep(i)}
              disabled={step.locked}
              className={[
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all select-none",
                isActive
                  ? "bg-[#E8792F] text-white shadow-sm"
                  : isCompleted
                    ? "bg-[#2D8A5E]/10 text-[#2D8A5E] border border-[#2D8A5E]/20"
                    : "bg-white text-[#6B6560] border border-[#E5E0DA]",
                step.locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-90",
              ].join(" ")}
            >
              <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold">
                {isCompleted && !isActive ? "✓" : i + 1}
              </span>
              <span>{step.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Two-column layout on desktop ──────────────────────────────────────── */}
      <div className="lg:flex lg:gap-5 lg:items-start">

      {/* Mobile: compact standing summary */}
      <div className="lg:hidden mb-4 bg-white rounded-xl border border-[#E5E0DA] shadow-sm p-3">
        <p className="text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest mb-2">Your Standing</p>
        <div className="flex gap-3 overflow-x-auto text-xs">
          {[
            { label: "GDP", val: (currentState?.gdpGrowth ?? 0).toFixed(1) + "%", ok: (currentState?.gdpGrowth ?? 0) > 2 },
            { label: "Inflation", val: (currentState?.inflation ?? 0).toFixed(1) + "%", ok: (currentState?.inflation ?? 0) < 6 },
            { label: "Deficit", val: (currentState?.fiscalDeficit ?? 0).toFixed(1) + "%", ok: (currentState?.fiscalDeficit ?? 0) < 4 },
            { label: "Approval", val: (currentState?.approvalRating ?? 0).toFixed(0) + "%", ok: (currentState?.approvalRating ?? 0) > 50 },
          ].map(m => (
            <div key={m.label} className="shrink-0 text-center">
              <p className="text-[10px] text-[#6B6560]">{m.label}</p>
              <p className={`font-mono font-bold ${m.ok ? "text-[#2D8A5E]" : "text-[#C4443A]"}`}>{m.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Left: form steps */}
      <div className="flex-1 min-w-0 space-y-0">

      {/* ── STEP 1: Monetary Policy ─────────────────────────────────────────── */}
      {currentStep === 0 && (
        <div className="space-y-4">
          <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-[#1A1A1A]" style={{ fontFamily: "DM Sans, sans-serif" }}>
                <Landmark className="h-5 w-5 text-[#E8792F]" /> Monetary Policy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Plain-English explainer */}
              <div className="bg-[#F5F2EE] rounded-lg px-3 py-2 text-xs text-[#6B6560] space-y-0.5">
                <p><span className="font-semibold text-[#2D8A5E]">Lower rate →</span> economy grows faster, prices rise, currency weakens</p>
                <p><span className="font-semibold text-[#C4443A]">Higher rate →</span> economy slows, inflation cools, currency strengthens</p>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm text-[#6B6560]">Interest Rate</Label>
                <div className="text-right">
                  <span className="text-3xl font-bold font-mono text-[#1A1A1A]">{interestRate.toFixed(1)}%</span>
                  <p className={`text-xs font-medium mt-0.5 ${interestLabelColor}`}>{interestLabel}</p>
                </div>
              </div>

              {/* Slider with gradient track */}
              <div className="relative">
                <div
                  className="absolute inset-0 h-2 top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                  style={{
                    background: "linear-gradient(to right, #2D8A5E 0%, #D4943A 50%, #C4443A 100%)",
                    opacity: 0.25,
                  }}
                />
                <Slider
                  value={[interestRate]}
                  onValueChange={v => setInterestRate(Array.isArray(v) ? v[0] : v)}
                  min={1} max={15} step={0.1}
                  className="w-full"
                />
              </div>

              <div className="flex justify-between text-xs text-[#6B6560]">
                <span>1% — Stimulative</span>
                <span>15% — Restrictive</span>
              </div>

              <p className="text-xs text-[#6B6560]">
                Max change ±1% per round. Previous round baseline: <span className="font-mono font-semibold">5.0%</span>
              </p>

              {/* Live Impact Preview */}
              <div className="bg-[#F5F2EE] rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-[#6B6560] uppercase tracking-wider mb-3">Projected Impact</p>
                {[
                  { label: "GDP Growth",  val: irGdpImpact,  positiveGood: true  },
                  { label: "Inflation",   val: irInflImpact, positiveGood: false },
                  { label: "Currency",    val: irFxImpact * -1, positiveGood: true  },
                ].map(({ label, val, positiveGood }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-[#6B6560]">{label}</span>
                    <span className={`text-xs font-mono font-semibold ${impactColor(val, positiveGood)}`}>
                      {signedArrow(val, positiveGood)} {fmtDelta(val)}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <LiveMetricsBar />
        </div>
      )}

      {/* ── STEP 2: Fiscal Policy ──────────────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="space-y-4">
          {/* Card A: Tax Rate */}
          <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-[#1A1A1A]" style={{ fontFamily: "DM Sans, sans-serif" }}>
                <Percent className="h-5 w-5 text-[#E8792F]" /> Tax Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-[#6B6560]">Income Tax Rate</Label>
                <span className="text-3xl font-bold font-mono text-[#1A1A1A]">{taxRate}%</span>
              </div>
              <Slider value={[taxRate]} onValueChange={v => setTaxRate(Array.isArray(v) ? v[0] : v)}
                min={10} max={35} step={1} className="w-full" />
              <div className="flex justify-between text-xs text-[#6B6560]"><span>10%</span><span>35%</span></div>

              <div className="bg-[#F5F2EE] rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-[#6B6560] uppercase tracking-wider mb-2">Projected Impact</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B6560]">Est. Revenue</span>
                  <span className="text-xs font-mono font-semibold text-[#1A1A1A]">
                    {((taxRate / 100) * gdp).toFixed(0)} units
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B6560]">GDP Impact</span>
                  <span className={`text-xs font-mono font-semibold ${impactColor(taxGdpImpact, true)}`}>
                    {signedArrow(taxGdpImpact, true)} {fmtDelta(taxGdpImpact)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card B: Budget Allocation */}
          <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-[#1A1A1A]" style={{ fontFamily: "DM Sans, sans-serif" }}>
                <Building className="h-5 w-5 text-[#E8792F]" /> Budget Allocation
              </CardTitle>
              <p className="text-xs text-[#6B6560]">Must sum to 100%</p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Stacked bar */}
              <div className="h-5 rounded-full overflow-hidden flex border border-[#E5E0DA]">
                <div style={{ width: `${infraSpending}%` }}   className="bg-[#2D8A5E] transition-all" />
                <div style={{ width: `${subsidySpending}%` }} className="bg-[#2E75B6] transition-all" />
                <div style={{ width: `${defenseSpending}%` }} className="bg-[#C4443A] transition-all" />
              </div>
              <div className="flex gap-4 text-xs text-[#6B6560]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2D8A5E] inline-block" />Infra {infraSpending}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2E75B6] inline-block" />Subsidies {subsidySpending}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C4443A] inline-block" />Defense {defenseSpending}%</span>
              </div>
              {[
                { key: "infra"   as const, val: infraSpending,   color: "bg-[#2D8A5E]", label: "Infrastructure", hint: "→ Builds roads, schools, factories. Boosts GDP growth every round." },
                { key: "subsidy" as const, val: subsidySpending, color: "bg-[#2E75B6]", label: "Subsidies",       hint: "→ Helps citizens with cost of living. Lowers unemployment, raises approval." },
                { key: "defense" as const, val: defenseSpending, color: "bg-[#C4443A]", label: "Defense",         hint: "→ Strengthens military. Needed to win conflicts and deter attacks." },
              ].map(({ key, val, color, label, hint }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-[#1A1A1A] flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${color}`} /> {label}
                    </Label>
                    <span className="font-mono font-bold text-[#1A1A1A]">{val}%</span>
                  </div>
                  <Slider value={[val]} onValueChange={v => adjustBudget(key, Array.isArray(v) ? v[0] : v)}
                    min={0} max={100} step={1} />
                  <p className="text-xs text-[#6B6560] mt-1">{hint}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Card C: Borrowing with Debt Gauge */}
          <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-[#1A1A1A]" style={{ fontFamily: "DM Sans, sans-serif" }}>
                <Banknote className="h-5 w-5 text-[#E8792F]" /> Borrowing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Plain-English explainer */}
              <div className="bg-[#F5F2EE] rounded-lg px-3 py-2 text-xs text-[#6B6560] space-y-0.5">
                <p><span className="font-semibold text-[#2D8A5E]">Borrow 0–3% →</span> safe, helps fund spending shortfalls</p>
                <p><span className="font-semibold text-[#D4943A]">Borrow 4–6% →</span> manageable but watch your debt total</p>
                <p><span className="font-semibold text-[#C4443A]">Borrow 7%+ →</span> credit rating drops, GDP penalty when debt/GDP &gt; 60%</p>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm text-[#6B6560]">Borrowing (% of GDP)</Label>
                <span className={`text-3xl font-bold font-mono ${borrowing > 8 ? "text-[#C4443A]" : borrowing > 5 ? "text-[#D4943A]" : "text-[#1A1A1A]"}`}>
                  {borrowing.toFixed(1)}%
                </span>
              </div>
              <Slider value={[borrowing]} onValueChange={v => setBorrowing(Array.isArray(v) ? v[0] : v)}
                min={0} max={DECISION_LIMITS.borrowing.max} step={0.5} className="w-full" />
              <div className="flex justify-between text-xs text-[#6B6560]">
                <span>0%</span><span>{DECISION_LIMITS.borrowing.max}% of GDP</span>
              </div>

              {/* Debt Gauge */}
              <div className="bg-[#F5F2EE] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-[#6B6560] uppercase tracking-wider">Debt / GDP Gauge</p>
                  <span className={`text-xs font-mono font-bold ${newDebt > 60 ? "text-[#C4443A]" : "text-[#1A1A1A]"}`}>
                    {newDebt.toFixed(1)}%
                  </span>
                </div>
                <div className="relative h-4 rounded-full bg-[#E5E0DA] overflow-visible">
                  <div
                    className={`h-full rounded-full transition-all ${newDebt > 60 ? "bg-[#C4443A]" : newDebt > 45 ? "bg-[#D4943A]" : "bg-[#2D8A5E]"}`}
                    style={{ width: `${Math.min(newDebt, 100)}%` }}
                  />
                  {/* 60% threshold marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[#D4943A]"
                    style={{ left: "60%" }}
                  >
                    <span className="absolute -top-5 -translate-x-1/2 text-[9px] text-[#D4943A] whitespace-nowrap font-mono">⚠ 60%</span>
                  </div>
                </div>
                {newDebt > 60 && (
                  <p className="text-xs text-[#C4443A] font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> GDP penalty active above 60% threshold
                  </p>
                )}
                <p className="text-xs text-[#6B6560]">
                  New total after borrowing: <span className="font-mono font-semibold">{newDebt.toFixed(1)}%</span>
                </p>
              </div>

              {borrowing > 5 && (
                <div className="flex items-center gap-2 text-xs text-[#C4443A] bg-red-50 p-3 rounded-xl border border-red-100">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  Debt accumulates with interest — penalizes GDP if total debt/GDP &gt; 60%
                </div>
              )}
            </CardContent>
          </Card>
          <LiveMetricsBar />
        </div>
      )}

      {/* ── STEP 3: Trade ─────────────────────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="space-y-4">
          {!tradeEnabled ? (
            <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
              <CardContent className="p-8 text-center text-[#6B6560]">
                <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold text-[#1A1A1A] mb-1">Trade not available this round</p>
                <p className="text-sm">Trade unlocks in Round 2. Continue to the next step.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Trade Openness slider */}
              <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-[#1A1A1A]" style={{ fontFamily: "DM Sans, sans-serif" }}>
                    <Globe className="h-5 w-5 text-[#E8792F]" /> Trade Openness
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-[#6B6560]">Openness Level</Label>
                    <span className={`text-lg font-bold font-mono ${
                      tradeOpenness < 0.3 ? "text-[#C4443A]" :
                      tradeOpenness > 0.7 ? "text-[#2D8A5E]" : "text-[#D4943A]"
                    }`}>{opennessLabel}</span>
                  </div>
                  <Slider value={[tradeOpenness * 10]} onValueChange={v => setTradeOpenness((Array.isArray(v) ? v[0] : v) / 10)}
                    min={0} max={10} step={1} className="w-full" />
                  <div className="flex justify-between text-xs text-[#6B6560]">
                    <span>Protectionist (−GDP, resistant)</span>
                    <span>Open (+GDP, vulnerable)</span>
                  </div>
                </CardContent>
              </Card>

              {/* Resource Dashboard */}
              {profile && (
                <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base text-[#1A1A1A]" style={{ fontFamily: "DM Sans, sans-serif" }}>
                      <Package className="h-5 w-5 text-[#E8792F]" /> Your Resource Profile
                    </CardTitle>
                    <p className="text-xs text-[#6B6560]">Surpluses can be exported. Deficits should be imported to avoid GDP drag.</p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#E5E0DA]">
                            <th className="text-left py-2 text-[#6B6560] font-medium">Commodity</th>
                            <th className="text-right py-2 text-[#6B6560] font-medium">Produce</th>
                            <th className="text-right py-2 text-[#6B6560] font-medium">Need</th>
                            <th className="text-right py-2 text-[#6B6560] font-medium">Balance</th>
                            <th className="text-right py-2 text-[#6B6560] font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {COMMODITIES.map(c => {
                            const produce  = profile[`${c}Production`] ?? 0;
                            const need     = profile[`${c}Consumption`] ?? 0;
                            const balance  = produce - need;
                            const surplus  = balance > 0;
                            return (
                              <tr
                                key={c}
                                className={`border-b border-[#F5F2EE] ${surplus ? "bg-green-50/40" : balance < 0 ? "bg-red-50/40" : ""}`}
                              >
                                <td className="py-2 font-medium text-[#1A1A1A] flex items-center gap-1">
                                  {COMMODITY_EMOJIS[c]} {COMMODITY_LABELS[c]}
                                </td>
                                <td className="py-2 text-right font-mono">{produce}</td>
                                <td className="py-2 text-right font-mono">{need}</td>
                                <td className={`py-2 text-right font-mono font-bold ${surplus ? "text-[#2D8A5E]" : balance < 0 ? "text-[#C4443A]" : "text-[#6B6560]"}`}>
                                  {balance > 0 ? "+" : ""}{balance}
                                </td>
                                <td className="py-2 text-right">
                                  {balance > 0
                                    ? <span className="text-[#2D8A5E] font-semibold">● SURPLUS</span>
                                    : balance < 0
                                      ? <span className="text-[#C4443A] font-semibold">● DEFICIT</span>
                                      : <span className="text-[#6B6560]">— BALANCED</span>
                                  }
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* World Price Strip */}
              <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-[#6B6560] font-semibold uppercase tracking-wider">
                    World Market Prices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {COMMODITIES.map(c => (
                      <div key={c} className="bg-[#F5F2EE] rounded-lg border border-[#E5E0DA] px-3 py-2 text-center min-w-[80px] flex-shrink-0">
                        <p className="text-base mb-0.5">{COMMODITY_EMOJIS[c]}</p>
                        <p className="font-mono font-bold text-[#1A1A1A] text-sm">${COMMODITY_BASE_PRICES[c]}</p>
                        <p className="text-[10px] text-[#6B6560] leading-tight mt-0.5">{COMMODITY_LABELS[c]}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Trade Order Cards */}
              <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-[#1A1A1A]" style={{ fontFamily: "DM Sans, sans-serif" }}>
                    <Package className="h-5 w-5 text-[#E8792F]" /> Commodity Trade Orders
                  </CardTitle>
                  <p className="text-xs text-[#6B6560]">Set export and import quantities. Prices shift with world supply & demand.</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  {COMMODITIES.map(c => {
                    const balance  = profile ? (profile[`${c}Production`] ?? 0) - (profile[`${c}Consumption`] ?? 0) : 0;
                    const importCost = imports[c] * COMMODITY_BASE_PRICES[c];
                    const uncovered  = balance < 0 ? Math.max(0, Math.abs(balance) - imports[c]) : 0;
                    return (
                      <div key={c} className="border border-[#E5E0DA] rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#1A1A1A] flex items-center gap-2">
                            {COMMODITY_EMOJIS[c]} {COMMODITY_LABELS[c]}
                          </p>
                          <span className="text-xs font-mono text-[#6B6560]">
                            World price: <span className="font-bold text-[#1A1A1A]">${COMMODITY_BASE_PRICES[c]}</span>
                          </span>
                        </div>
                        {balance !== 0 && (
                          <p className={`text-xs ${balance < 0 ? "text-[#C4443A]" : "text-[#2D8A5E]"}`}>
                            Your balance: {balance > 0 ? "+" : ""}{balance} ({balance < 0 ? "DEFICIT" : "SURPLUS"})
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Export */}
                          <div>
                            <div className="flex items-center gap-1 text-xs text-[#2D8A5E] font-medium mb-2">
                              <TrendingUp className="h-3 w-3" /> Export
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setExports(prev => ({ ...prev, [c]: Math.max(0, prev[c] - 1) }))}
                                className="w-10 h-10 rounded-lg border border-[#E5E0DA] text-[#6B6560] hover:bg-[#F5F2EE] font-bold text-base flex items-center justify-center transition-colors"
                              >−</button>
                              <span className="font-mono font-bold text-center w-8 text-[#1A1A1A] text-lg">{exports[c]}</span>
                              <button
                                onClick={() => setExports(prev => ({ ...prev, [c]: Math.min(DECISION_LIMITS.commodityQuantity.max, prev[c] + 1) }))}
                                className="w-10 h-10 rounded-lg border border-[#E5E0DA] text-[#6B6560] hover:bg-[#F5F2EE] font-bold text-base flex items-center justify-center transition-colors"
                              >+</button>
                            </div>
                          </div>
                          {/* Import */}
                          <div>
                            <div className="flex items-center gap-1 text-xs text-[#C4443A] font-medium mb-2">
                              <TrendingDown className="h-3 w-3" /> Import
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setImports(prev => ({ ...prev, [c]: Math.max(0, prev[c] - 1) }))}
                                className="w-10 h-10 rounded-lg border border-[#E5E0DA] text-[#6B6560] hover:bg-[#F5F2EE] font-bold text-base flex items-center justify-center transition-colors"
                              >−</button>
                              <span className="font-mono font-bold text-center w-8 text-[#1A1A1A] text-lg">{imports[c]}</span>
                              <button
                                onClick={() => setImports(prev => ({ ...prev, [c]: Math.min(DECISION_LIMITS.commodityQuantity.max, prev[c] + 1) }))}
                                className="w-10 h-10 rounded-lg border border-[#E5E0DA] text-[#6B6560] hover:bg-[#F5F2EE] font-bold text-base flex items-center justify-center transition-colors"
                              >+</button>
                            </div>
                          </div>
                        </div>
                        {imports[c] > 0 && (
                          <p className="text-xs text-[#6B6560] font-mono">
                            Import cost: {imports[c]} × ${COMMODITY_BASE_PRICES[c]} = <span className="font-bold text-[#1A1A1A]">${importCost}</span>
                          </p>
                        )}
                        {uncovered > 0 && (
                          <p className="text-xs text-[#D4943A] flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            You still need {uncovered} more unit{uncovered !== 1 ? "s" : ""} to cover your deficit
                          </p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          )}
          <LiveMetricsBar />
        </div>
      )}

      {/* ── STEP 4: Diplomacy ─────────────────────────────────────────────── */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-[#1A1A1A]" style={{ fontFamily: "DM Sans, sans-serif" }}>
                <Handshake className="h-5 w-5 text-[#E8792F]" /> Diplomatic Action
              </CardTitle>
              <p className="text-xs text-[#6B6560]">Choose one diplomatic stance for this round.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Card-based selector */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DIPLO_OPTIONS.map(opt => {
                  const locked =
                    (opt.requiresTrade    && !tradeEnabled)    ||
                    (opt.requiresConflict && !conflictsEnabled);
                  const selected = diplomaticAction === opt.value;
                  const borderColorMap: Record<string, string> = {
                    gray:  selected ? "border-[#6B6560] bg-[#F5F2EE]" : "border-[#E5E0DA] bg-white hover:bg-[#F5F2EE]",
                    green: selected ? "border-[#2D8A5E] bg-green-50"   : "border-[#E5E0DA] bg-white hover:bg-green-50/30",
                    blue:  selected ? "border-[#2E75B6] bg-blue-50"    : "border-[#E5E0DA] bg-white hover:bg-blue-50/30",
                    red:   selected ? "border-[#C4443A] bg-red-50"     : "border-[#E5E0DA] bg-white hover:bg-red-50/30",
                  };
                  return (
                    <button
                      key={opt.value}
                      disabled={locked}
                      onClick={() => { if (!locked) { setDiplomaticAction(opt.value); if (opt.value === "none") setDiplomaticTarget(""); } }}
                      className={[
                        "relative flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all",
                        borderColorMap[opt.color],
                        locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                      ].join(" ")}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span className="text-xs font-semibold text-[#1A1A1A]">{opt.label}</span>
                      <span className="text-[10px] text-[#6B6560] leading-tight">{opt.desc}</span>
                      {locked && (
                        <span className="text-[9px] text-[#C4443A] font-medium mt-0.5">
                          {opt.requiresConflict ? "Unlocks Round 3" : "Unlocks Round 2"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Target nation selector */}
              {diplomaticAction !== "none" && (
                <div className="space-y-2">
                  <Label className="text-sm text-[#6B6560]">Target Nation</Label>
                  <Select value={diplomaticTarget} onValueChange={v => { if (v) setDiplomaticTarget(v); }}>
                    <SelectTrigger className="rounded-xl border-[#E5E0DA]">
                      <SelectValue placeholder="Select target nation">
                        {diplomaticTarget
                          ? (() => { const t = otherTeams.find(x => x.id === diplomaticTarget); return t ? `${t.flagEmoji} ${t.name}` : "Select target nation"; })()
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {otherTeams.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.flagEmoji} {t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Aggressive warning */}
              {isAggressive && (
                <div className="flex items-start gap-2 text-xs text-[#C4443A] bg-red-50 p-3 rounded-xl border border-red-100">
                  <Swords className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Aggressive actions hurt both sides economically and lower your diplomacy score. Allies may retaliate.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Power-Up Card */}
          {myTeam && (
            <Card className={[
              "rounded-xl border-2 shadow-sm transition-all",
              powerUpUsed
                ? "border-[#E5E0DA] bg-white opacity-60"
                : usePowerUp
                  ? "border-[#E8792F] bg-orange-50"
                  : "border-[#E5E0DA] bg-white ring-2 ring-[#E8792F]/30",
              !powerUpUsed && !usePowerUp ? "animate-pulse" : "",
            ].join(" ")}
            style={!powerUpUsed && !usePowerUp ? { animationDuration: "2.5s" } : {}}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-[#1A1A1A]" style={{ fontFamily: "DM Sans, sans-serif" }}>
                  <Zap className={`h-5 w-5 ${usePowerUp ? "text-[#E8792F]" : powerUpUsed ? "text-[#6B6560]" : "text-[#E8792F]"}`} />
                  Special Power-Up
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-semibold text-[#1A1A1A]">{powerUpName}</p>
                    <p className="text-xs text-[#6B6560]">{powerUpDesc}</p>
                    {powerUpUsed && (
                      <p className="text-xs text-[#C4443A] font-semibold mt-1">✗ Already used this game</p>
                    )}
                    {!powerUpUsed && (
                      <p className="text-[10px] text-[#6B6560] mt-1">⚠ Other nations won&apos;t know what you used</p>
                    )}
                  </div>
                  <button
                    disabled={powerUpUsed}
                    onClick={() => {
                      if (!usePowerUp) {
                        if (confirm(`Activate "${powerUpName}"? This is a one-time use.`)) {
                          setUsePowerUp(true);
                        }
                      } else {
                        setUsePowerUp(false);
                      }
                    }}
                    className={[
                      "min-w-[90px] px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0",
                      powerUpUsed
                        ? "bg-[#F5F2EE] text-[#6B6560] cursor-not-allowed"
                        : usePowerUp
                          ? "bg-[#E8792F] text-white shadow-sm"
                          : "bg-[#F5F2EE] text-[#1A1A1A] hover:bg-[#E8792F]/10 border border-[#E5E0DA]",
                    ].join(" ")}
                  >
                    {powerUpUsed ? "Used" : usePowerUp ? "Activated ✓" : "Activate"}
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
          <LiveMetricsBar />
        </div>
      )}

      {/* ── STEP 5: Review & Submit ────────────────────────────────────────── */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#1A1A1A]" style={{ fontFamily: "DM Sans, sans-serif" }}>
                Round {currentRound} Decisions — Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {/* Divider line */}
              <div className="border-t border-[#E5E0DA] mb-4" />

              {/* Summary rows */}
              <div className="space-y-2">
                {/* Monetary */}
                <div className="flex items-center justify-between py-2 border-b border-[#F5F2EE]">
                  <span className="text-xs text-[#6B6560] uppercase tracking-wider font-semibold">Monetary</span>
                  <span className="text-sm font-mono text-[#1A1A1A]">
                    Interest Rate <span className="font-bold">{interestRate.toFixed(1)}%</span>
                    <span className={`ml-2 text-xs ${interestLabelColor}`}>({interestLabel})</span>
                  </span>
                </div>

                {/* Fiscal */}
                <div className="flex items-center justify-between py-2 border-b border-[#F5F2EE]">
                  <span className="text-xs text-[#6B6560] uppercase tracking-wider font-semibold">Fiscal</span>
                  <span className="text-sm font-mono text-[#1A1A1A]">
                    Tax <span className="font-bold">{taxRate}%</span> — Est. Revenue <span className="font-bold">${budRevenue.toFixed(0)}B</span>
                  </span>
                </div>

                {/* Budget */}
                <div className="flex items-center justify-between py-2 border-b border-[#F5F2EE]">
                  <span className="text-xs text-[#6B6560] uppercase tracking-wider font-semibold">Budget</span>
                  <span className="text-sm font-mono text-[#1A1A1A]">
                    Infra <span className="font-bold">{infraSpending}%</span> / Sub <span className="font-bold">{subsidySpending}%</span> / Def <span className="font-bold">{defenseSpending}%</span>
                    <span className="text-[#6B6560] ml-1">(of ${totalBudget.toFixed(0)}B)</span>
                  </span>
                </div>

                {/* Borrowing */}
                <div className="flex items-center justify-between py-2 border-b border-[#F5F2EE]">
                  <span className="text-xs text-[#6B6560] uppercase tracking-wider font-semibold">Borrowing</span>
                  <span className={`text-sm font-mono ${borrowing > 5 ? "text-[#C4443A]" : "text-[#1A1A1A]"}`}>
                    <span className="font-bold">{borrowing.toFixed(1)}%</span> of GDP — New debt/GDP: <span className="font-bold">{newDebt.toFixed(1)}%</span>
                  </span>
                </div>

                {/* Trade */}
                {tradeEnabled && (
                  <div className="flex items-start justify-between py-2 border-b border-[#F5F2EE]">
                    <span className="text-xs text-[#6B6560] uppercase tracking-wider font-semibold mt-0.5">Trade</span>
                    <div className="text-right space-y-0.5">
                      <p className="text-xs text-[#6B6560]">Openness: <span className="font-mono font-semibold text-[#1A1A1A]">{opennessLabel}</span></p>
                      {COMMODITIES.filter(c => exports[c] > 0 || imports[c] > 0).length === 0 ? (
                        <p className="text-xs text-[#6B6560] italic">No orders placed</p>
                      ) : (
                        COMMODITIES.filter(c => exports[c] > 0 || imports[c] > 0).map(c => (
                          <p key={c} className="text-xs font-mono text-[#1A1A1A]">
                            {COMMODITY_EMOJIS[c]}&nbsp;
                            {exports[c] > 0 && <span className="text-[#2D8A5E]">Export {exports[c]}</span>}
                            {exports[c] > 0 && imports[c] > 0 && <span className="text-[#6B6560]"> / </span>}
                            {imports[c] > 0 && <span className="text-[#C4443A]">Import {imports[c]}</span>}
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Diplomacy */}
                <div className="flex items-center justify-between py-2 border-b border-[#F5F2EE]">
                  <span className="text-xs text-[#6B6560] uppercase tracking-wider font-semibold">Diplomacy</span>
                  <span className="text-sm text-[#1A1A1A]">
                    {diplomaticAction === "none" ? (
                      <span className="text-[#6B6560] italic">No action</span>
                    ) : (
                      <>
                        <span className="font-semibold">{DIPLO_OPTIONS.find(o => o.value === diplomaticAction)?.label}</span>
                        {diplomaticTarget && (
                          <span className="text-[#6B6560]"> → {otherTeams.find(t => t.id === diplomaticTarget)?.flagEmoji} {otherTeams.find(t => t.id === diplomaticTarget)?.name}</span>
                        )}
                      </>
                    )}
                  </span>
                </div>

                {/* Power-Up */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-[#6B6560] uppercase tracking-wider font-semibold">Power-Up</span>
                  <span className={`text-sm font-semibold ${usePowerUp ? "text-[#E8792F]" : "text-[#6B6560]"}`}>
                    {powerUpUsed ? "Already used" : usePowerUp ? `⚡ ${powerUpName}` : "Not activated"}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[#E5E0DA] my-4" />

              {/* Estimated Impact — client-side projection, not the final simulated result */}
              <div className="bg-[#F5F2EE] rounded-xl p-4 space-y-2">
                <div className="mb-3">
                  <p className="text-xs font-semibold text-[#6B6560] uppercase tracking-wider">Projected Outcome (Estimate)</p>
                  <p className="text-[10px] text-[#9E9890] mt-0.5">Based on your inputs only — actual results include trade, events & diplomacy</p>
                </div>
                {[
                  { label: "GDP Growth",       val: projGDP,       positiveGood: true  },
                  { label: "Inflation",         val: projInflation, positiveGood: false },
                  { label: "Fiscal Deficit",    val: projDeficit,   positiveGood: false },
                  { label: "New Debt / GDP",    val: newDebt,       positiveGood: false, isAbsolute: true },
                ].map(({ label, val, positiveGood, isAbsolute }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-[#6B6560]">{label}</span>
                    {isAbsolute ? (
                      <span className={`text-sm font-mono font-bold ${val > 60 ? "text-[#C4443A]" : "text-[#1A1A1A]"}`}>
                        {val.toFixed(1)}%
                      </span>
                    ) : (
                      <span className={`text-sm font-mono font-bold ${impactColor(val, positiveGood)}`}>
                        {signedArrow(val, positiveGood)} {fmtDelta(val)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Submit / Confirm */}
          {!showConfirm ? (
            <Button
              onClick={() => setShowConfirm(true)}
              className="w-full h-14 rounded-xl bg-[#E8792F] hover:bg-[#d16a25] text-white font-bold text-lg"
              disabled={alreadySubmitted}
            >
              Submit Decisions
            </Button>
          ) : (
            <Card className="rounded-xl border-2 border-[#E8792F] shadow-lg bg-white">
              <CardContent className="p-6 text-center space-y-4">
                <p className="font-semibold text-[#1A1A1A]">Confirm your decisions for Round {currentRound}?</p>
                <p className="text-sm text-[#6B6560]">Once submitted, you cannot change them.</p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowConfirm(false)}>
                    Go Back
                  </Button>
                  <Button
                    className="flex-1 rounded-xl bg-[#E8792F] hover:bg-[#d16a25] text-white"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Confirm & Submit"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={!canGoPrev}
          className="rounded-xl border-[#E5E0DA] text-[#6B6560] px-5"
        >
          ← Previous
        </Button>
        {canGoNext && currentStep < steps.length - 1 && (
          <Button
            onClick={goNext}
            className="rounded-xl bg-[#E8792F] hover:bg-[#d16a25] text-white px-6 font-semibold"
          >
            Next →
          </Button>
        )}
      </div>

      </div>{/* end left form column */}

      {/* Right: sticky live guide sidebar */}
      <div className="hidden lg:block w-72 shrink-0">
        <div className="sticky top-4 space-y-3">

          {/* Section 0: Objective Card — TOP */}
          <ObjectiveCard
            country={{ rNeutral: profRN }}
            currentMetrics={{
              gdpGrowth:     currentState?.gdpGrowth     ?? 0,
              inflation:     currentState?.inflation     ?? 4,
              deficit:       currentState?.fiscalDeficit ?? 0,
              fxStability,
              diplomacyScore,
            }}
          />

          {/* Section 1: Your Economy Now */}
          <div className="bg-white rounded-xl border border-[#E5E0DA] shadow-sm p-4">
            <p className="text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest mb-3">Your Economy Now</p>
            {currentState ? (
              <div className="space-y-2">
                {[
                  { label: "GDP Growth",    val: currentState.gdpGrowth.toFixed(1) + "%",    ok: currentState.gdpGrowth > 2,    target: "Target: >3%"  },
                  { label: "Inflation",      val: currentState.inflation.toFixed(1) + "%",    ok: currentState.inflation < 5,    target: "Target: 2–4%" },
                  { label: "Fiscal Deficit", val: currentState.fiscalDeficit.toFixed(1) + "%",ok: currentState.fiscalDeficit < 4, target: "Target: <4%"  },
                  { label: "Unemployment",   val: currentState.unemployment.toFixed(1) + "%", ok: currentState.unemployment < 7,  target: "Target: <6%"  },
                  { label: "Approval",       val: currentState.approvalRating.toFixed(0) + "%",ok: currentState.approvalRating > 50,target: "Target: >60%" },
                  { label: "Credit Rating",  val: currentState.creditRating ?? "A",           ok: ["AAA","AA","A"].includes(currentState.creditRating ?? "A"), target: "Stay investment grade" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1 border-b border-[#F5F2EE] last:border-0">
                    <div>
                      <p className="text-xs font-medium text-[#1A1A1A]">{row.label}</p>
                      <p className="text-[10px] text-[#6B6560]">{row.target}</p>
                    </div>
                    <span className={`text-sm font-bold font-mono ${row.ok ? "text-[#2D8A5E]" : "text-[#C4443A]"}`}>
                      {row.val}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#6B6560]">No data yet — Round 1 results show after simulation.</p>
            )}
          </div>

          {/* Section 2: Live Impact Preview */}
          <div className="bg-white rounded-xl border border-[#E5E0DA] shadow-sm p-4">
            <p className="text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest mb-1">These Settings Will...</p>
            <p className="text-[10px] text-[#6B6560] mb-3">Live estimate based on your choices</p>
            <div className="space-y-2">
              {[
                { label: "GDP Growth",    proj: projGDP,      dir: projGDP > 0, suffix: "%", note: projGDP > profGPot ? "above potential 🔥" : projGDP > 0 ? "positive" : "contracting ⚠️" },
                { label: "Inflation",     proj: projInflation, dir: projInflation < 4, suffix: "%", note: projInflation < 2 ? "deflation risk" : projInflation < 5 ? "on target" : projInflation < 9 ? "rising — watch" : "high — raise rates!" },
                { label: "Deficit",       proj: projDeficit,   dir: projDeficit < 3, suffix: "%", note: projDeficit < 3 ? "manageable" : projDeficit < 6 ? "watch closely" : "credit risk ⚠️" },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#6B6560]">{row.label}</span>
                    <span className={`text-sm font-mono font-bold ${row.dir ? "text-[#2D8A5E]" : "text-[#C4443A]"}`}>
                      {row.proj > 0 ? "+" : ""}{row.proj.toFixed(1)}{row.suffix}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#6B6560]">{row.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: What Scores Points */}
          <div className="bg-white rounded-xl border border-[#E5E0DA] shadow-sm p-4">
            <p className="text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest mb-3">What Scores Points</p>
            <div className="space-y-2">
              {[
                { label: "GDP Growth",        pts: 25, tip: "Higher growth = more points" },
                { label: "Inflation (2–4% range)", pts: 25, tip: "2–4% sweet spot = max points" },
                { label: "Low Deficit",       pts: 15, tip: "Borrow less = more points" },
                { label: "Trade & Currency",  pts: 20, tip: "Export surpluses, stable FX" },
                { label: "Diplomacy",         pts: 15, tip: "Trade deals help both sides" },
              ].map(row => (
                <div key={row.label} className="flex items-start justify-between gap-2 py-1 border-b border-[#F5F2EE] last:border-0">
                  <div>
                    <p className="text-xs font-medium text-[#1A1A1A]">{row.label}</p>
                    <p className="text-[10px] text-[#6B6560]">{row.tip}</p>
                  </div>
                  <span className="text-xs font-bold text-[#E8792F] shrink-0">{row.pts}pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Decision quick-reference */}
          <div className="bg-[#1B2A4A] rounded-xl p-4">
            <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-3">Quick Reference</p>
            <div className="space-y-2 text-xs text-white/80">
              <p><span className="text-white font-semibold">Interest Rate ↓</span> → growth ↑, inflation ↑</p>
              <p><span className="text-white font-semibold">Interest Rate ↑</span> → inflation ↓, growth ↓</p>
              <p><span className="text-white font-semibold">High Infra (35–50%)</span> → best GDP growth</p>
              <p><span className="text-white font-semibold">High Subsidy</span> → lower unemployment</p>
              <p><span className="text-white font-semibold">Borrow &gt;6%</span> → credit rating drops</p>
              <p><span className="text-white font-semibold">Debt &gt;60% GDP</span> → growth penalized</p>
              <p><span className="text-white font-semibold">Trade Deals</span> → +0.5% GDP for both</p>
              <p><span className="text-white font-semibold">Sanctions</span> → hurts target & you</p>
            </div>
          </div>

        </div>
      </div>

      </div>{/* end flex wrapper */}
    </div>
  );
}
