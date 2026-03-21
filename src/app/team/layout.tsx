"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GrainBackground } from "@/components/shared/GrainBackground";

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "team")) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] relative">
      <GrainBackground />
      <header className="sticky top-0 z-50 bg-[#E8792F] px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="text-white text-sm font-bold font-mono">M</span>
            </div>
            <span className="text-xl font-bold text-white font-[family-name:var(--font-dm-sans)] tracking-tight">
              MACRO TRADER
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/80 font-medium">
              {user.teamName}
            </span>
            <button
              onClick={logout}
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
