"use client";

interface RoundIntroProps {
  round: number;
  scenario: {
    title: string;
    description: string;
    mechanicText: string;
  };
  teamName: string;
  flagEmoji: string;
  onDismiss: () => void;
}

export function RoundIntroOverlay({
  round,
  scenario,
  teamName,
  flagEmoji,
  onDismiss,
}: RoundIntroProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl text-center space-y-4">
        <div className="text-sm font-bold text-[#E8792F] uppercase tracking-widest">
          Round {round} of 4
        </div>
        <h1 className="text-3xl font-bold text-[#1A1A1A] font-(family-name:--font-dm-sans)">
          {scenario.title}
        </h1>
        <p className="text-[#6B6560]">{scenario.description}</p>
        <div className="bg-[#F5F2EE] rounded-xl p-4 text-sm font-mono text-[#1A1A1A] text-left whitespace-pre-wrap">
          {scenario.mechanicText}
        </div>
        <div className="bg-[#FEF3EC] border border-[#E8792F]/20 rounded-xl p-4 text-sm text-left">
          <p className="text-xs font-bold text-[#E8792F] uppercase mb-1">
            {flagEmoji} Your Briefing
          </p>
          <p className="text-[#1A1A1A]">
            {teamName} — review your economy stats and plan your decisions carefully.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="w-full py-3 bg-[#E8792F] hover:bg-[#d16a25] text-white font-bold rounded-xl transition-all active:scale-95"
        >
          BEGIN ROUND →
        </button>
      </div>
    </div>
  );
}
