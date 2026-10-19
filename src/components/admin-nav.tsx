"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useKazu } from "@/components/providers";

const TABS = [
  {
    href: "/admin",
    label: "Vozni red",
    match: (path: string) => path === "/admin" || path.startsWith("/admin/linije"),
    text: "Otvori liniju i uredi polaske. Izmjena je odmah vidljiva putnicima.",
  },
  {
    href: "/admin/karta",
    label: "Stajališta i ceste",
    match: (path: string) => path.startsWith("/admin/karta"),
    text: "Povlačenje stajališta odmah sprema cestu do susjednih čvorova. Običan čvor složi, pa spremi cestu.",
  },
  {
    href: "/admin/prijedlozi",
    label: "Prijedlozi lokacija",
    match: (path: string) => path.startsWith("/admin/prijedlozi"),
    text: "Prihvati ili odbij prijedlog točnijeg mjesta stajališta.",
  },
  {
    href: "/admin/obavijesti",
    label: "Nova obavijest",
    match: (path: string) => path.startsWith("/admin/obavijesti"),
    text: "Objavi obavijest za jednu liniju, za više linija ili za sve.",
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const { user, loading } = useKazu();
  if (loading || !user || user.role !== "admin") return null;
  const current = TABS.find((tab) => tab.match(pathname)) ?? TABS[0];
  return (
    <div className="shrink-0 border-b bg-background px-4 py-3">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const on = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-3 py-1.5 text-sm ${on ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{current.text}</p>
    </div>
  );
}
