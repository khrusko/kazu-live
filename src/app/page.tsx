import { Suspense } from "react";
import { TripHome } from "@/components/trip-home";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-muted-foreground">Učitavam…</p>}>
      <TripHome />
    </Suspense>
  );
}
