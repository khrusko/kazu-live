import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Obavijesti · Kazu bus",
  description: "Pregled obavijesti i izmjena voznog reda autobusnih linija Karlovačke županije (Kazu / Kazup).",
  path: "/obavijesti",
});

export default function ObavijestiLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
