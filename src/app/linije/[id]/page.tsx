import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { Suspense } from "react";
import { LineView } from "@/components/line-view";
import { pageMetadata } from "@/lib/seo";

function findLine(id: string) {
  try {
    const file = path.join(process.cwd(), "data", "network.json");
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      lines: { id: string; code: string; name: string }[];
    };
    return raw.lines.find((line) => line.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const line = findLine(id);
  if (!line) {
    return pageMetadata({
      title: "Linija nije pronađena",
      description: "Tražena autobusna linija ne postoji u voznom redu.",
      path: `/linije/${encodeURIComponent(id)}`,
      index: false,
    });
  }

  return pageMetadata({
    title: `${line.code} ${line.name} · vozni red`,
    description: `Vozni red linije ${line.code} (${line.name}) – Kazu bus / Kazup, Karlovačka županija. Neslužbeni raspored polazaka.`,
    path: `/linije/${encodeURIComponent(line.id)}`,
  });
}

export default async function LinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Učitavam liniju…</p>}>
      <LineView id={decodeURIComponent(id)} />
    </Suspense>
  );
}
