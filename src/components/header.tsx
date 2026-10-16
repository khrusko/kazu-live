"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Bus, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKazu } from "@/components/providers";
import { formatWhen } from "@/lib/time";

const LINKS = [
  { href: "/", label: "Vožnja" },
  { href: "/karta", label: "Karta" },
  { href: "/linije", label: "Linije" },
  { href: "/obavijesti", label: "Obavijesti" },
  { href: "/karte", label: "Karte" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, network, favoriteLineIds, setUser } = useKazu();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const seenKey = "kazu-seen";
  const [seen, setSeen] = useState("");

  useEffect(() => {
    setSeen(localStorage.getItem(seenKey) || "");
  }, []);

  const notices = (network?.announcements ?? []).filter(
    (item) => item.lineIds.length === 0 || item.lineIds.some((id) => favoriteLineIds.includes(id)),
  );
  const unseen = notices.filter((item) => !seen || item.publishedAt > seen).length;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  function markSeen() {
    const stamp = new Date().toISOString();
    localStorage.setItem(seenKey, stamp);
    setSeen(stamp);
    setBell(false);
    router.push("/obavijesti");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[oklch(0.34_0.06_168)] text-white">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
        <Link href="/" className="flex items-center gap-2 pr-2">
          <span className="grid size-8 place-items-center rounded-full bg-white/15">
            <Bus className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="font-display block text-[15px] tracking-tight">KaŽu Live</span>
            <span className="hidden text-[10px] tracking-wide text-white/70 sm:block">
              Autobus Karlovačke županije
            </span>
          </span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-1.5 text-sm ${
                pathname === link.href ? "bg-white text-[oklch(0.34_0.06_168)]" : "text-white/85 hover:bg-white/10"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {user?.role === "admin" && (
            <Link
              href="/admin"
              className={`rounded-full px-3 py-1.5 text-sm ${
                pathname.startsWith("/admin") ? "bg-white text-[oklch(0.34_0.06_168)]" : "text-white/85 hover:bg-white/10"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <button
            type="button"
            className="relative grid size-9 place-items-center rounded-full hover:bg-white/10"
            aria-label="Obavijesti za favorite"
            onClick={() => setBell((value) => !value)}
          >
            <Bell className="size-4" />
            {unseen > 0 && (
              <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-[oklch(0.68_0.16_55)] px-1 text-[10px] font-semibold text-[oklch(0.25_0.04_55)]">
                {unseen}
              </span>
            )}
          </button>
          {user ? (
            <Link href="/racun" className="hidden rounded-full bg-white/10 px-3 py-1.5 text-sm md:inline">
              {user.name.split(" ")[0]}
            </Link>
          ) : (
            <Link href="/prijava" className="hidden rounded-full bg-white px-3 py-1.5 text-sm text-[oklch(0.34_0.06_168)] md:inline">
              Prijava
            </Link>
          )}
          <button type="button" className="grid size-9 place-items-center rounded-full hover:bg-white/10 md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Izbornik">
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {bell && (
        <div className="absolute right-3 z-50 mt-1 w-[min(100vw-1.5rem,22rem)] rounded-2xl bg-popover p-3 text-popover-foreground shadow-xl ring-1 ring-foreground/10">
          <p className="px-1 text-xs text-muted-foreground">
            {favoriteLineIds.length
              ? "Obavijesti za omiljene linije i opće obavijesti."
              : "Označite liniju srcem da dobijete obavijest samo za nju. Ovdje su zasad sve opće."}
          </p>
          <div className="mt-2 max-h-72 space-y-2 overflow-auto">
            {(notices.length ? notices : network?.announcements ?? []).slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-xl bg-muted px-3 py-2">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{formatWhen(item.publishedAt)}</p>
              </div>
            ))}
          </div>
          <Button className="mt-3 w-full" size="lg" onClick={markSeen}>
            Otvori obavijesti
          </Button>
        </div>
      )}
      {open && (
        <div className="space-y-1 border-t border-white/10 px-3 py-3 md:hidden">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-white/10">
              {link.label}
            </Link>
          ))}
          {user?.role === "admin" && (
            <Link href="/admin" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-white/10">
              Admin
            </Link>
          )}
          {user ? (
            <>
              <Link href="/racun" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-white/10">
                {user.name}
              </Link>
              <button type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10" onClick={logout}>
                Odjava
              </button>
            </>
          ) : (
            <Link href="/prijava" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-white/10">
              Prijava
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
