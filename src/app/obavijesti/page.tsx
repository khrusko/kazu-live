"use client";

import Link from "next/link";
import { useKazu } from "@/components/providers";
import { formatWhen } from "@/lib/time";

const TONE: Record<string, string> = {
  change: "bg-[oklch(0.95_0.04_75)]",
  warning: "bg-[oklch(0.95_0.03_35)]",
  info: "bg-muted",
};

export default function NewsPage() {
  const { network, loading, favoriteLineIds } = useKazu();
  if (loading || !network) return <p className="p-8 text-sm">Učitavam obavijesti…</p>;
  const mine = network.announcements.filter(
    (item) => item.lineIds.length === 0 || item.lineIds.some((id) => favoriteLineIds.includes(id)),
  );
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-display text-4xl">Obavijesti</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Obavijesti o izmjenama voznog reda. Zvonce broji obavijesti za omiljene linije.
      </p>
      {favoriteLineIds.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium">Za vaše linije</h2>
          <div className="mt-2 space-y-2">
            {mine.length === 0 && <p className="text-sm text-muted-foreground">Nema posebnih obavijesti za spremljene linije.</p>}
            {mine.map((item) => (
              <article key={item.id} className={`rounded-2xl px-4 py-3 ${TONE[item.severity]}`}>
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-1 text-sm">{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="mt-8 space-y-3">
        {network.announcements.map((item) => (
          <article key={item.id} className="rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{formatWhen(item.publishedAt)}</span>
              {item.lineIds.map((id) => (
                <Link key={id} href={`/linije/${id}`} className="rounded-full bg-muted px-2 py-0.5 text-foreground">
                  {network.lines.find((line) => line.id === id)?.code ?? id}
                </Link>
              ))}
            </div>
            <h2 className="mt-1 text-lg font-medium">{item.title}</h2>
            <p className="mt-1 text-sm leading-relaxed">{item.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
