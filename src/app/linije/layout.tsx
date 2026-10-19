import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Linije · Kazu bus Karlovačka županija",
  description:
    "Popis autobusnih linija Karlovačke županije (Kazu / Kazup). Neslužbeni vozni red po grupama A–E.",
  path: "/linije",
});

export default function LinijeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
