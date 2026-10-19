import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Karta · Kazu bus Karlovačka županija",
  description:
    "Interaktivna karta autobusnih linija i stajališta Karlovačke županije (Kazu / Kazup). Neslužbeni prikaz.",
  path: "/karta",
});

export default function KartaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
