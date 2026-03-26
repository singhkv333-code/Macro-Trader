"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0F1923] flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1923] text-white">
      <header className="sticky top-0 z-50 bg-[#0F1923]/90 backdrop-blur-md border-b border-white/10 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold tracking-wider font-[family-name:var(--font-dm-sans)]">
              Capital Catalyst <span className="text-[#E8792F]">ADMIN</span>
            </span>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin" className="text-gray-400 hover:text-white transition-colors">
                Dashboard
              </Link>
              <Link href="/admin/control" className="text-gray-400 hover:text-white transition-colors">
                Control
              </Link>
              <Link href="/admin/setup" className="text-gray-400 hover:text-white transition-colors">
                Setup
              </Link>
            </nav>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="p-6">
        {children}
      </main>
      <footer className="text-center text-xs text-gray-600 py-4 border-t border-white/5">
        Episteme 2026 | Finance and Investment Cell, SRCC
      </footer>
    </div>
  );
}
