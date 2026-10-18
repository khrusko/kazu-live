import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Registracija",
  description: "Registracija na Sizel Busevi.",
  path: "/registracija",
  index: false,
});

export default function RegistracijaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
