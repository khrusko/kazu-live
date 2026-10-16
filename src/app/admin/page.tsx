"use client";

import Link from "next/link";
import { useKazu } from "@/components/providers";
import { GROUP_LABEL } from "@/lib/schedule";

export default function AdminHome() {
  const { user, network, loading } = useKazu();
  if (loading) return <p className="p-8 text-sm">Učitavam…</p>;
  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl">Dispečer</h1>
        <p className="mt-2 text-sm">Ovaj dio je za izmjenu voznog reda. Prijavite se kao admin.</p>
        <Link href="/prijava?next=/admin" className="mt-3 inline-block text-sm text-primary">Prijava</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <p className="text-sm text-muted-foreground">Dispečerski stol</p>
      <h1 className="font-display text-4xl">Izmjena reda ide odmah na kartu</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Spremljeni polazak putnici vide u roku od nekoliko sekundi, bez novog PDF-a. Uz izmjenu možete objaviti obavijest za omiljene linije.
      </p>
      <div className="mt-4 flex gap-2">
        <Link href="/admin/obavijesti" className="rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          Nova obavijest
        </Link>
        <Link href="/karte" className="rounded-full bg-muted px-3 py-1.5 text-sm">Karte putnika</Link>
      </div>
      <div className="mt-8 space-y-6">
        {["A", "B", "C", "D", "E"].map((group) => (
          <section key={group}>
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{GROUP_LABEL[group]}</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {(network?.lines ?? [])
                .filter((line) => line.group === group)
                .map((line) => (
                  <li key={line.id}>
                    <Link href={`/admin/linije/${line.id}`} className="flex items-center justify-between rounded-2xl bg-card px-3 py-3 ring-1 ring-foreground/10 hover:bg-muted">
                      <span className="text-sm font-medium">{line.code} · {line.name}</span>
                      <span className="text-xs text-muted-foreground">uredi</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
