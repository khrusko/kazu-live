"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const MapApp = dynamic(() => import("@/components/map-app").then((mod) => mod.MapApp), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      Učitavam kartu…
    </div>
  ),
});

export function MapLoader() {
  return (
    <Suspense fallback={<div className="grid h-full place-items-center text-sm">Učitavam kartu…</div>}>
      <MapApp />
    </Suspense>
  );
}
