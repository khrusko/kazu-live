import { Suspense } from "react";
import { MapApp } from "@/components/map-app";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="grid h-[calc(100dvh-3.5rem)] place-items-center text-sm">Učitavam kartu…</div>}>
      <MapApp />
    </Suspense>
  );
}
