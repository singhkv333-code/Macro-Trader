"use client";

interface NewsTickerProps {
  items: Array<{ headline: string; type: string; round: number }>;
}

const CAT_STYLE: Record<string, { label: string; bg: string }> = {
  conflict: { label: "🔴 CRISIS",    bg: "bg-red-600" },
  crisis:   { label: "🟠 ALERT",     bg: "bg-amber-600" },
  economic: { label: "🟠 ECONOMIC",  bg: "bg-amber-500" },
  trade:    { label: "🟢 TRADE",     bg: "bg-green-600" },
  alliance: { label: "🔵 DIPLOMACY", bg: "bg-blue-600" },
};

export function NewsTicker({ items }: NewsTickerProps) {
  if (!items || items.length === 0) return null;

  // Duplicate items so the scroll loop is seamless
  const doubled = [...items, ...items];

  return (
    <div className="fixed bottom-20 lg:bottom-0 left-0 right-0 z-30 bg-[#1A1A1A] text-white overflow-hidden h-8 flex items-center">
      {/* LIVE badge */}
      <div className="shrink-0 bg-[#E8792F] px-3 h-full flex items-center">
        <span className="text-xs font-bold uppercase tracking-wider">LIVE</span>
      </div>

      {/* Scrolling content */}
      <div className="overflow-hidden flex-1 relative">
        <div className="flex animate-[ticker_30s_linear_infinite] gap-8 pl-4 whitespace-nowrap text-sm">
          {doubled.map((item, i) => {
            const cat = CAT_STYLE[item.type as keyof typeof CAT_STYLE];
            return (
              <span key={i} className="inline-flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold">
                  {cat?.label ?? "⚪ NEWS"}
                </span>
                <span className="text-gray-100">{item.headline}</span>
                <span className="text-gray-500 text-xs">· R{item.round}</span>
                <span className="text-gray-600 text-xs mx-2">|</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
