import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function GuidePage() {
  return (
    <div className="max-w-3xl mx-auto pb-10 space-y-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]" style={{ fontFamily: "DM Sans, sans-serif" }}>
          Player Guide
        </h1>
        <p className="text-[#6B6560] text-sm mt-1">
          Everything you need to play Capital Catalyst well. Read this before Round 1.
        </p>
      </div>

      {/* ── Scoring Overview ─────────────────────────────────────────────────── */}
      <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-base text-[#1A1A1A]">🏆 How Scoring Works (100 Points Total)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-[#6B6560]">
          {[
            { pts: 25, label: "GDP Growth",         desc: "Higher cumulative growth across all rounds = more points. Above your country's potential growth rate is excellent." },
            { pts: 25, label: "Inflation Stability", desc: "2–4% is the sweet spot — full 25 points. Graduated penalty outside that range (see details below)." },
            { pts: 15, label: "Fiscal Discipline",   desc: "Lower average deficit = more points. Surplus earns maximum. Deficits above 6% hurt badly." },
            { pts: 20, label: "Trade & Currency",    desc: "Stable currency (near index 100) + positive trade balance. Active trade deals help both." },
            { pts: 15, label: "Diplomacy",           desc: "Trade deals, alliances, and avoiding conflicts. Sanctions and wars reduce your diplomacy score." },
          ].map(row => (
            <div key={row.label} className="flex gap-3 py-2 border-b border-[#F5F2EE] last:border-0">
              <span className="text-base font-bold text-[#E8792F] shrink-0 w-10">{row.pts}pts</span>
              <div>
                <p className="font-semibold text-[#1A1A1A]">{row.label}</p>
                <p className="text-xs leading-relaxed mt-0.5">{row.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Inflation Scoring ─────────────────────────────────────────────────── */}
      <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-base text-[#1A1A1A]">📊 How Inflation Scoring Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[#6B6560]">
          <p>
            Inflation is scored on a <strong className="text-[#1A1A1A]">target range</strong>, not a single number.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3 items-start bg-emerald-50 rounded-lg p-3">
              <span className="text-lg shrink-0">🟢</span>
              <div>
                <p className="font-semibold text-emerald-700">2–4% → Full 25 points (the sweet spot)</p>
                <p className="text-xs mt-0.5">
                  Both India's RBI (target: 4%) and the US Fed (target: 2%) fall in this range.
                  If your inflation is anywhere between 2% and 4%, you get maximum points.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start bg-amber-50 rounded-lg p-3">
              <span className="text-lg shrink-0">⚠️</span>
              <div>
                <p className="font-semibold text-amber-700">Slightly outside (0–2% or 4–6%) → Small penalty</p>
                <p className="text-xs mt-0.5">
                  You're close. Adjusting interest rates by 1–2% should get you back in range within 1–2 rounds.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start bg-red-50 rounded-lg p-3">
              <span className="text-lg shrink-0">🔴</span>
              <div>
                <p className="font-semibold text-red-700">Far outside (&lt;0% or &gt;8%) → Large penalty</p>
                <p className="text-xs mt-0.5">
                  Deflation (below 0%) means people stop spending — the economy stagnates.
                  High inflation (above 8%) erodes savings and causes unrest.
                </p>
              </div>
            </div>
          </div>

          {/* Score table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5E0DA]">
                  <th className="text-left py-2 text-[#6B6560] font-semibold">Inflation</th>
                  <th className="text-right py-2 text-[#6B6560] font-semibold">Score / 25</th>
                  <th className="text-right py-2 text-[#6B6560] font-semibold">Zone</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { infl: "-1% (deflation)", score: "19", zone: "⚠️ Below range" },
                  { infl: "0%",             score: "21", zone: "Near range" },
                  { infl: "1%",             score: "23", zone: "Near range" },
                  { infl: "2%",             score: "25", zone: "🟢 Sweet spot", highlight: true },
                  { infl: "3%",             score: "25", zone: "🟢 Sweet spot", highlight: true },
                  { infl: "4%",             score: "25", zone: "🟢 Sweet spot", highlight: true },
                  { infl: "5%",             score: "23", zone: "Near range" },
                  { infl: "6%",             score: "21", zone: "Above range" },
                  { infl: "8%",             score: "16", zone: "⚠️ High" },
                  { infl: "10%",            score: "11", zone: "🔴 Crisis" },
                  { infl: "12%",            score: "8",  zone: "🔴 Severe" },
                  { infl: "15%",            score: "5 (floor)", zone: "🔴 Hyperinflation" },
                ].map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[#F5F2EE] ${(row as any).highlight ? "bg-emerald-50 font-semibold" : ""}`}
                  >
                    <td className="py-1.5 text-[#1A1A1A] font-mono">{row.infl}</td>
                    <td className="py-1.5 text-right font-mono text-[#1A1A1A]">{row.score}</td>
                    <td className="py-1.5 text-right text-[#6B6560]">{row.zone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-[#F5F2EE] rounded-lg p-3 space-y-2">
            <p className="font-semibold text-[#1A1A1A] text-xs uppercase tracking-wide">How to control inflation:</p>
            <ul className="text-xs space-y-1.5">
              <li><span className="font-semibold text-[#C4443A]">Too high?</span> Raise your interest rate above your neutral rate (shown on your Country Profile)</li>
              <li><span className="font-semibold text-[#2D8A5E]">Too low?</span> Cut your interest rate below neutral to stimulate demand</li>
              <li><span className="font-semibold text-[#D4943A]">Stuck?</span> Inflation has inertia — 60% of last round carries over. Be patient, it takes 2–3 rounds of consistent policy to move significantly.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* ── GDP Growth ──────────────────────────────────────────────────────── */}
      <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-base text-[#1A1A1A]">📈 How to Grow GDP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-[#6B6560]">
          <p>GDP growth depends on three main levers:</p>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-[#2D8A5E] font-bold shrink-0">①</span>
              <div>
                <span className="font-semibold text-[#1A1A1A]">Infrastructure spending (35–50% is optimal)</span>
                <p className="text-xs mt-0.5">The biggest single driver of GDP growth. Below 25% gives little boost; above 60% leaves too little for subsidies and defense.</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-[#2D8A5E] font-bold shrink-0">②</span>
              <div>
                <span className="font-semibold text-[#1A1A1A]">Interest rate near your neutral rate</span>
                <p className="text-xs mt-0.5">Your neutral rate is printed on your Country Profile. Being 1–2% above or below is fine. Going far above slows the economy; far below risks inflation.</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-[#2D8A5E] font-bold shrink-0">③</span>
              <div>
                <span className="font-semibold text-[#1A1A1A]">Avoid high debt</span>
                <p className="text-xs mt-0.5">Debt/GDP above 60% triggers a growth penalty. Keep borrowing under 5% each round.</p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* ── Trade & Diplomacy ────────────────────────────────────────────────── */}
      <Card className="rounded-xl border border-[#E5E0DA] shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-base text-[#1A1A1A]">🤝 Trade & Diplomacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-[#6B6560]">
          <div className="space-y-2">
            <p><span className="font-semibold text-[#2D8A5E]">Trade Deals</span> — +0.5% GDP for both nations every active round. Best diplomatic action.</p>
            <p><span className="font-semibold text-[#2E75B6]">Alliances</span> — Military pact; mutual defense. Doesn't hurt GDP.</p>
            <p><span className="font-semibold text-[#C4443A]">Sanctions</span> — Target loses –1% GDP, but <em>you</em> lose –0.3% and your diplomacy score drops.</p>
            <p><span className="font-semibold text-[#C4443A]">Trade War</span> — Both sides lose –0.8% GDP. Almost never worth it.</p>
            <p><span className="font-semibold text-[#C4443A]">Military Conflict</span> — High-risk. Win: +1% GDP. Lose: –2.5% GDP + approval crash.</p>
          </div>
          <div className="bg-[#F5F2EE] rounded-lg p-3 text-xs">
            <p className="font-semibold text-[#1A1A1A] mb-1">Commodity Trade (Round 2+)</p>
            <p>Export your surpluses to earn revenue. Import your deficits to avoid a GDP drag. Check your Resource Profile on the Trade step.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Back link ────────────────────────────────────────────────────────── */}
      <div className="pt-2">
        <Link href="/team" className="text-sm text-[#E8792F] hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
