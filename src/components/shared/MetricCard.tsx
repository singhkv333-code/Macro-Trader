"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SparklineChart } from "./SparklineChart";

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  delta?: number;
  unit?: string;
  status?: "healthy" | "warning" | "critical";
  sparkData?: number[];
  compact?: boolean;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  delta,
  unit = "",
  status = "healthy",
  sparkData,
  compact = false,
}: MetricCardProps) {
  const borderColor = {
    healthy: "border-l-[#2D8A5E]",
    warning: "border-l-[#D4943A]",
    critical: "border-l-[#C4443A]",
  }[status];

  const bgTint = {
    healthy: "bg-[#2D8A5E]/5",
    warning: "bg-[#D4943A]/5",
    critical: "bg-[#C4443A]/5",
  }[status];

  const sparkColor = {
    healthy: "#2D8A5E",
    warning: "#D4943A",
    critical: "#C4443A",
  }[status];

  const deltaPositive = delta !== undefined && delta > 0;
  const deltaNegative = delta !== undefined && delta < 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-[#E5E0DA] border-l-4 p-3 shadow-sm transition-all hover:shadow-md",
        "bg-white",
        bgTint,
        borderColor
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-[#6B6560] uppercase tracking-widest leading-none">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-[#6B6560]/60 shrink-0" />
      </div>

      {/* Value */}
      <div
        className={cn(
          "font-bold text-[#1A1A1A] leading-none font-[family-name:var(--font-ibm-plex-mono)] tabular-nums",
          compact ? "text-2xl mt-1" : "text-3xl mt-2"
        )}
      >
        {typeof value === "number" ? value.toFixed(1) : value}
        {unit && (
          <span className={cn("font-normal text-[#6B6560]", compact ? "text-base" : "text-lg")}>
            {unit}
          </span>
        )}
      </div>

      {/* Delta pill */}
      {delta !== undefined && delta !== 0 && (
        <div className="mt-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full",
              deltaPositive && "text-[#2D8A5E] bg-[#2D8A5E]/10",
              deltaNegative && "text-[#C4443A] bg-[#C4443A]/10",
              !deltaPositive && !deltaNegative && "text-[#6B6560] bg-[#6B6560]/10"
            )}
          >
            {deltaPositive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} from last round
          </span>
        </div>
      )}

      {/* Sparkline */}
      {!compact && sparkData && sparkData.length >= 2 && (
        <div className="mt-2 -mx-0.5">
          <SparklineChart data={sparkData} color={sparkColor} />
        </div>
      )}
    </div>
  );
}
