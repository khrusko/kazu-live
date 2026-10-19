import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Prijava",
  description: "Prijava na Sizel Busevi.",
  path: "/prijava",
  index: false,
});

export default function PrijavaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
