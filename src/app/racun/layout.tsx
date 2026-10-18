import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Račun",
  description: "Korisnički račun Sizel Busevi.",
  path: "/racun",
  index: false,
});

export default function RacunLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
