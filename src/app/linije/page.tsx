"use client";

import Link from "next/link";
import { useKazu } from "@/components/providers";
import { GROUP_LABEL } from "@/lib/schedule";

export default function LinesPage() {
  const { network, loading, error } = useKazu();
  if (loading) return <p className="p-8 text-sm">Učitavam linije…</p>;
  if (error || !network) return <p className="p-8 text-sm">{error}</p>;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="font-display text-4xl">Linije</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Podaci su preuzeti sa službenih rasporeda na kazup.hr.
      </p>
      <div className="mt-8 space-y-8">
        {["A", "B", "C", "D", "E"].map((group) => (
          <section key={group}>
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{GROUP_LABEL[group]}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {network.lines
                .filter((line) => line.group === group)
                .map((line) => (
                  <li key={line.id}>
                    <Link href={`/linije/${line.id}`} className="flex items-center gap-3 rounded-2xl bg-card px-3 py-3 ring-1 ring-foreground/10 hover:bg-muted">
                      <span className="grid h-8 min-w-12 place-items-center rounded-full px-2 text-xs font-semibold text-white" style={{ background: line.color }}>
                        {line.code}
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{line.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {line.directions.length} smjera · {line.directions.reduce((sum, direction) => sum + direction.trips.length, 0)} polazaka
                        </span>
                      </span>
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
