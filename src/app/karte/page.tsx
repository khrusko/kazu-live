"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES, SALES_POINTS, TICKET_TYPES, money, quoteFare } from "@/lib/fares";
import { findRides } from "@/lib/schedule";
import { useKazu } from "@/components/providers";
import type { CategoryId, Ticket, TicketType } from "@/lib/types";

function TicketDesk() {
  const params = useSearchParams();
  const { network, user, loading } = useKazu();
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [originId, setOriginId] = useState(params.get("od") ?? "");
  const [destId, setDestId] = useState("");
  const [lineId, setLineId] = useState("");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [ticketType, setTicketType] = useState<TicketType | null>(null);
  const [issued, setIssued] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);

  const stops = network?.stops ?? [];
  const origin = stops.find((stop) => stop.id === originId);
  const destination = stops.find((stop) => stop.id === destId);
  const rides = useMemo(
    () => (originId && destId ? findRides(network?.lines ?? [], originId, destId) : []),
    [network?.lines, originId, destId],
  );
  const ride = rides.find((item) => item.line.id === lineId) ?? rides[0];
  const priced =
    ride && category && ticketType
      ? quoteFare({ km: ride.km, ticketType, category, touristDailyUsed: 0 })
      : null;

  function hits(query: string) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return stops.filter((stop) => stop.name.toLowerCase().includes(q)).slice(0, 6);
  }

  async function buy() {
    if (!user) {
      toast.error("Prijavite se prije izdavanja karte.");
      return;
    }
    if (!ride || !category || !ticketType) return;
    setBusy(true);
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineId: ride.line.id,
          originStopId: originId,
          destinationStopId: destId,
          ticketType,
          category,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Karta nije izdana.");
      setIssued(data.ticket);
      toast.success("Karta je izdana. Plaćanje je zasad rezervacija.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="p-8 text-sm">Učitavam cjenik…</p>;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1.3fr_0.7fr]">
      <div>
        <p className="text-sm text-muted-foreground">Kupnja karte</p>
        <h1 className="font-display text-4xl">Relacija, popust, pa cijena</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cijena slijedi službene zone prema kilometrima iz voznog reda. Prvo birate popust, zatim vrstu karte, i tek onda vidite iznos.
        </p>

        <section className="mt-6 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">1. Polazište i odredište</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <StopField
              label="Polazište"
              query={origin ? origin.name : originQuery}
              results={origin ? [] : hits(originQuery)}
              onQuery={(value) => {
                setOriginQuery(value);
                setOriginId("");
                setIssued(null);
              }}
              onPick={(id, name) => {
                setOriginId(id);
                setOriginQuery(name);
                setLineId("");
                setIssued(null);
              }}
            />
            <StopField
              label="Odredište"
              query={destination ? destination.name : destQuery}
              results={destination ? [] : hits(destQuery)}
              onQuery={(value) => {
                setDestQuery(value);
                setDestId("");
                setIssued(null);
              }}
              onPick={(id, name) => {
                setDestId(id);
                setDestQuery(name);
                setLineId("");
                setIssued(null);
              }}
            />
          </div>
          {originId && destId && originId === destId && (
            <p className="mt-3 text-sm text-destructive">Polazište i odredište moraju biti različita stajališta.</p>
          )}
          {origin && destination && originId !== destId && rides.length === 0 && (
            <p className="mt-3 text-sm text-destructive">Nijedna linija ne vozi tim redom od polazišta do odredišta.</p>
          )}
          {rides.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {rides.map((item) => (
                <button
                  key={item.line.id}
                  type="button"
                  onClick={() => setLineId(item.line.id)}
                  className={`rounded-full px-3 py-1.5 text-sm ${(ride?.line.id === item.line.id) ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {item.line.code} · {item.km.toFixed(1)} km
                </button>
              ))}
            </div>
          )}
          {ride && (
            <p className="mt-3 text-sm">
              Zona se računa za <strong>{ride.km.toFixed(1)} km</strong> na liniji {ride.line.code}, {ride.direction.name}.
            </p>
          )}
        </section>

        <section className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">2. Primjenjuje li se popust?</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Učenici, osobe starije od 65 i osobe s invaliditetom imaju 100% na mjesečnu i godišnju. Studenti i socijalno ugroženi 50%, nezaposleni 30%. Turist ima 3 dnevne karte.
          </p>
          {user?.category && user.category !== "puni" && (
            <p className="mt-2 text-xs">Na računu je spremljeno: {CATEGORIES.find((item) => item.id === user.category)?.label}.</p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={`rounded-xl px-3 py-2 text-left text-sm ring-1 ${category === item.id ? "bg-primary text-primary-foreground ring-primary" : "ring-foreground/10"}`}
              >
                <span className="block font-medium">{item.label}</span>
                <span className={`block text-xs ${category === item.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {item.id === "turist" ? "100% na do 3 dnevne karte" : item.percent ? `${item.percent}% na mjesečnu i godišnju` : "Puna cijena"}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">3. Vrsta karte</h2>
          {!ride || !category ? (
            <p className="mt-2 text-sm text-muted-foreground">Prvo odaberite relaciju i popust. Osnovne cijene zone pojavit će se ovdje.</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {TICKET_TYPES.map((type) => {
                const preview = quoteFare({ km: ride.km, ticketType: type.id, category, touristDailyUsed: 0 });
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setTicketType(type.id)}
                    className={`rounded-xl px-3 py-3 text-left ring-1 ${ticketType === type.id ? "bg-accent ring-accent" : "ring-foreground/10"}`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{type.label}</span>
                      <span className="font-display text-xl">{money(preview.price)}</span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Zona {preview.zone.id} · osnovica {money(preview.base)}
                      {preview.percent ? ` · −${preview.percent}%` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {priced && ride && (
          <section className="mt-4 rounded-2xl bg-[oklch(0.34_0.06_168)] p-5 text-white">
            <p className="text-xs tracking-wide text-white/70 uppercase">Za platiti</p>
            <p className="font-display text-5xl">{money(priced.price)}</p>
            <p className="mt-2 text-sm text-white/85">
              {ride.line.code} · {origin?.name} → {destination?.name} · zona {priced.zone.id} · {priced.note}
            </p>
            {priced.overMax && (
              <p className="mt-1 text-xs text-white/70">Relacija je dulja od 75 km, cijena je za zonu IX.</p>
            )}
            {user ? (
              <Button className="mt-4 bg-white text-[oklch(0.34_0.06_168)]" size="lg" disabled={busy} onClick={buy}>
                {busy ? "Izdajem…" : "Izdaj kartu"}
              </Button>
            ) : (
              <Button className="mt-4 bg-white text-[oklch(0.34_0.06_168)]" size="lg" render={<Link href="/prijava?next=/karte" />}>
                Prijava za izdavanje
              </Button>
            )}
            <p className="mt-3 text-xs text-white/70">
              Online naplata je pripremljena kao rezervacija. Kartu i dalje možete kupiti na blagajni.
            </p>
          </section>
        )}

        {issued && (
          <div className="mt-4 rounded-2xl border border-dashed border-foreground/20 bg-card p-4">
            <p className="text-xs text-muted-foreground">Izdano · {issued.id}</p>
            <p className="font-display text-2xl">{issued.originName} → {issued.destinationName}</p>
            <p className="text-sm">{issued.lineCode} · {money(issued.price)} · plaćanje slijedi</p>
            <Link href="/racun" className="mt-2 inline-block text-sm text-primary">Moje karte</Link>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-display text-xl">Blagajne</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {SALES_POINTS.map((point) => (
              <li key={point.id}>
                <p className="font-medium">{point.place}</p>
                <p className="text-muted-foreground">{point.address}</p>
                <p className="text-xs text-muted-foreground">{point.hours}</p>
                <Link href={`/karta?blagajna=${point.id}`} className="text-xs text-primary">Na karti</Link>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Cjenik je preuzet sa stranice kažu ide bus — cijene karata. Subvencije vrijede za mjesečne i godišnje karte, uz iznimku triju dnevnih za turiste.
        </p>
      </aside>
    </div>
  );
}

function StopField({
  label,
  query,
  results,
  onQuery,
  onPick,
}: {
  label: string;
  query: string;
  results: { id: string; name: string }[];
  onQuery: (value: string) => void;
  onPick: (id: string, name: string) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <Input className="mt-1 h-9" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Počnite tipkati" />
      {results.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-xl bg-muted">
          {results.map((stop) => (
            <li key={stop.id}>
              <button type="button" className="w-full px-2 py-1.5 text-left hover:bg-background" onClick={() => onPick(stop.id, stop.name)}>
                {stop.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Učitavam…</p>}>
      <TicketDesk />
    </Suspense>
  );
}
