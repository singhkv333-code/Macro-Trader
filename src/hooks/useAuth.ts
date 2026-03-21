"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface User {
  userId: string;
  username: string;
  role: string;
  teamId: string | null;
  teamName?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        // Session invalid — redirect to login
        if (res.status === 401) {
          router.push("/login");
        }
        return null;
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser({
        userId: data.user.id,
        username: data.user.username,
        role: data.user.role,
        teamId: data.user.teamId,
        teamName: data.user.teamName,
      });
      if (data.user.role === "admin") router.push("/admin/control");
      else router.push("/team");
    },
    [router]
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  }, [router]);

  return { user, loading, login, logout };
}
