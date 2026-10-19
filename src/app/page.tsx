import type { Metadata } from "next";
import { Suspense } from "react";
import { TripHome } from "@/components/trip-home";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Kazu bus · vozni red Karlovačke županije | Sizel",
  description:
    "Kazu bus / Kazup bus – planiraj vožnju, stajališta i linije Karlovačke županije. Neslužbeni vozni red, nepovezan s Karlovačkom županijom.",
  path: "/",
  absolute: true,
});

export default function HomePage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-muted-foreground">Učitavam…</p>}>
      <TripHome />
    </Suspense>
  );
}
