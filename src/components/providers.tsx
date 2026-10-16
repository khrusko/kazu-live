"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Network, PublicUser } from "@/lib/types";

type LocalFav = { lines: string[]; stops: string[] };

type KazuContext = {
  network: Network | null;
  loading: boolean;
  error: string | null;
  user: PublicUser | null;
  favoriteLineIds: string[];
  favoriteStopIds: string[];
  refresh: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: PublicUser | null) => void;
  toggleLine: (id: string) => Promise<void>;
  toggleStop: (id: string) => Promise<void>;
};

const Ctx = createContext<KazuContext | null>(null);
const FAV_KEY = "kazu-fav";

function readLocal(): LocalFav {
  if (typeof window === "undefined") return { lines: [], stops: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(FAV_KEY) || "") as LocalFav;
    return {
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      stops: Array.isArray(parsed.stops) ? parsed.stops : [],
    };
  } catch {
    return { lines: [], stops: [] };
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<Network | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [localFav, setLocalFav] = useState<LocalFav>({ lines: [], stops: [] });
  const versionRef = useRef(0);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/network", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Vozni red nije učitan.");
    versionRef.current = data.version;
    setNetwork(data);
    setError(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await response.json();
    setUser(data.user ?? null);
  }, []);

  useEffect(() => {
    setLocalFav(readLocal());
    refresh()
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
    refreshUser().catch(() => setUser(null));
  }, [refresh, refreshUser]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetch("/api/meta", { cache: "no-store" })
        .then((response) => response.json())
        .then((meta: { version?: number }) => {
          if (meta.version && meta.version !== versionRef.current) return refresh();
          return null;
        })
        .catch(() => undefined);
    }, 12000);
    return () => clearInterval(timer);
  }, [refresh]);

  const persistLocal = (next: LocalFav) => {
    setLocalFav(next);
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  const toggleLine = useCallback(
    async (id: string) => {
      if (user) {
        const response = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId: id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Favorit nije spremljen.");
        setUser(data.user);
        return;
      }
      const lines = localFav.lines.includes(id)
        ? localFav.lines.filter((item) => item !== id)
        : [...localFav.lines, id];
      persistLocal({ ...localFav, lines });
    },
    [user, localFav],
  );

  const toggleStop = useCallback(
    async (id: string) => {
      if (user) {
        const response = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stopId: id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Favorit nije spremljen.");
        setUser(data.user);
        return;
      }
      const stops = localFav.stops.includes(id)
        ? localFav.stops.filter((item) => item !== id)
        : [...localFav.stops, id];
      persistLocal({ ...localFav, stops });
    },
    [user, localFav],
  );

  const value = useMemo<KazuContext>(
    () => ({
      network,
      loading,
      error,
      user,
      favoriteLineIds: user ? user.favoriteLineIds : localFav.lines,
      favoriteStopIds: user ? user.favoriteStopIds : localFav.stops,
      refresh,
      refreshUser,
      setUser,
      toggleLine,
      toggleStop,
    }),
    [network, loading, error, user, localFav, refresh, refreshUser, toggleLine, toggleStop],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKazu() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useKazu mora biti unutar Providers.");
  return value;
}
