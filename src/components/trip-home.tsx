"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKazu } from "@/components/providers";
import { fold, formatMeters, pickNearest } from "@/lib/geo";
import { planJourneys, type Itinerary } from "@/lib/plan";
import { departuresForStop, legShape, linesAtStop, stopOnShape } from "@/lib/schedule";
import { DAY_LABEL, formatWait, showTime, zagrebParts } from "@/lib/time";
import type { Line, Stop } from "@/lib/types";

const RouteMap = dynamic(() => import("@/components/route-map").then((mod) => mod.RouteMap), {
  ssr: false,
  loading: () => <div className="grid h-56 place-items-center text-sm text-muted-foreground sm:h-72">Učitavam kartu rute…</div>,
});

export function TripHome() {
  const params = useSearchParams();
  const router = useRouter();
  const { network, loading, error } = useKazu();
  const [now, setNow] = useState(() => zagrebParts());
  const [loc, setLoc] = useState<"idle" | "pending" | "ok" | "denied" | "unsupported">("idle");
  const [originId, setOriginId] = useState<string | null>(null);
  const [meters, setMeters] = useState<number | null>(null);
  const [nearby, setNearby] = useState<{ stop: Stop; meters: number }[]>([]);
  const [originQuery, setOriginQuery] = useState("");
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [destQuery, setDestQuery] = useState("");
  const [destId, setDestId] = useState<string | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (params.get("stop") || params.get("linija") || params.get("blagajna")) {
      router.replace(`/karta?${params.toString()}`);
    }
  }, [params, router]);

  useEffect(() => {
    const timer = setInterval(() => setNow(zagrebParts()), 15000);
    return () => clearInterval(timer);
  }, []);

  const stops = useMemo(() => network?.stops ?? [], [network]);
  const lines = useMemo(() => network?.lines ?? [], [network]);

  function applyFix(latitude: number, longitude: number) {
    const pick = pickNearest(stops, latitude, longitude);
    if (!pick) {
      setLoc("denied");
      return;
    }
    setOriginId(pick.stop.id);
    setMeters(pick.meters);
    setNearby(pick.nearby);
    setEditingOrigin(false);
    setOriginQuery("");
    setLoc("ok");
  }

  function locate() {
    if (!navigator.geolocation) {
      setLoc("unsupported");
      setEditingOrigin(true);
      return;
    }
    setLoc("pending");
    navigator.geolocation.getCurrentPosition(
      (position) => applyFix(position.coords.latitude, position.coords.longitude),
      () => {
        setLoc("denied");
        setEditingOrigin(true);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000 },
    );
  }

  useEffect(() => {
    if (!stops.length || asked.current) return;
    asked.current = true;
    locate();
    // Ask once, when the timetable is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.length]);

  const origin = stops.find((stop) => stop.id === originId) ?? null;
  const destination = stops.find((stop) => stop.id === destId) ?? null;
  const originHits =
    editingOrigin && originQuery.trim().length > 0
      ? stops.filter((stop) => fold(stop.name).includes(fold(originQuery.trim()))).slice(0, 8)
      : [];
  const destHits =
    !destId && destQuery.trim().length > 0
      ? stops.filter((stop) => stop.id !== originId && fold(stop.name).includes(fold(destQuery.trim()))).slice(0, 8)
      : [];

  const departures = useMemo(
    () => (origin ? departuresForStop(lines, stops, origin.id, now.day).filter((item) => item.minutes >= now.minutes).slice(0, 4) : []),
    [origin, lines, stops, now.day, now.minutes],
  );
  const serving = origin ? linesAtStop(lines, origin.id) : [];

  const planned = useMemo(() => {
    if (!originId || !destId) return { items: [] as Itinerary[], later: false };
    const upcoming = planJourneys(lines, stops, originId, destId, now.day, now.minutes);
    if (upcoming.length) return { items: upcoming, later: false };
    return { items: planJourneys(lines, stops, originId, destId, now.day, 0), later: true };
  }, [lines, stops, originId, destId, now.day, now.minutes]);

  const drawn = useMemo(
    () => planned.items.map((item) => drawPlan(item, lines) ?? { parts: [], pins: [] }),
    [planned.items, lines],
  );

  if (loading) {
    return <p className="px-4 py-10 text-sm text-muted-foreground">Učitavam vozni red…</p>;
  }
  if (error || !network) {
    return <p className="px-4 py-10 text-sm">{error || "Vozni red nije dostupan."}</p>;
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{now.dateLabel} · {now.clock} · {DAY_LABEL[now.day]}</p>
      <h1 className="font-display mt-1 text-4xl leading-none">Kamo putujete?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Lokacija služi samo u svrhu pronalaska najbližeg autobusnog stajališta.
      </p>

      <section className="mt-4 rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
        {!origin || editingOrigin ? (
          <div>
            <p className="text-sm font-medium">Najbliže stajalište</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {loc === "pending"
                ? "Tražim lokaciju…"
                : loc === "denied"
                  ? "Preglednik nije dao lokaciju. Upišite stajalište ili pokušajte ponovo."
                  : "Uključite lokaciju pa ćemo odabrati stajalište do kojeg ste najbliže."}
            </p>
            <Button className="mt-3 h-12 w-full text-base" size="lg" onClick={locate} disabled={loc === "pending"}>
              <LocateFixed className="size-4" />
              {loc === "pending" ? "Tražim…" : "Uključi lokaciju"}
            </Button>
            <label className="mt-4 block text-xs text-muted-foreground">Ili upišite stajalište</label>
            <Input
              value={originQuery}
              onChange={(event) => setOriginQuery(event.target.value)}
              placeholder="npr. Ozalj"
              className="mt-1 h-12"
              autoComplete="off"
            />
            {originHits.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-2xl bg-muted">
                {originHits.map((stop) => (
                  <li key={stop.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-3 text-left text-base hover:bg-background"
                      onClick={() => {
                        setOriginId(stop.id);
                        setMeters(null);
                        setNearby([]);
                        setEditingOrigin(false);
                        setOriginQuery("");
                        if (destId === stop.id) setDestId(null);
                      }}
                    >
                      {stop.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Polazište</p>
                <h2 className="font-display text-2xl leading-tight">{origin.name}</h2>
                {meters != null && <p className="mt-1 text-sm text-muted-foreground">oko {formatMeters(meters)} od vas</p>}
              </div>
              <button type="button" className="shrink-0 text-sm text-primary" onClick={() => setEditingOrigin(true)}>
                Promijeni
              </button>
            </div>
            {meters != null && meters > 2000 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Najbliže stajalište je daleko. Ako niste uz tu stanicu, odaberite je ručno.
              </p>
            )}
            {nearby.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {nearby.map((item) => (
                  <button
                    key={item.stop.id}
                    type="button"
                    className="rounded-full bg-muted px-3 py-2 text-sm"
                    onClick={() => {
                      setOriginId(item.stop.id);
                      setMeters(item.meters);
                    }}
                  >
                    {item.stop.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {origin && !editingOrigin && (
        <>
          <section className="mt-3 rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
            <label className="text-sm font-medium" htmlFor="dest">Kamo</label>
            <Input
              id="dest"
              value={destination ? destination.name : destQuery}
              onChange={(event) => {
                setDestQuery(event.target.value);
                setDestId(null);
              }}
              placeholder="npr. Duga Resa"
              className="mt-2 h-12"
              autoComplete="off"
            />
            {destHits.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-2xl bg-muted">
                {destHits.map((stop) => (
                  <li key={stop.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-3 text-left text-base hover:bg-background"
                      onClick={() => {
                        setDestId(stop.id);
                        setDestQuery(stop.name);
                      }}
                    >
                      {stop.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!destination && (
            <section className="mt-3 rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="text-sm font-medium">Sljedeći polasci s ovog stajališta</h2>
              {departures.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Danas više nema polazaka u ovom rasporedu.</p>
              ) : (
                <ul className="mt-2 divide-y">
                  {departures.map((item) => (
                    <li key={`${item.tripId}-${item.time}-${item.directionId}`} className="flex items-center gap-3 py-3">
                      <span className="w-14 shrink-0">
                        <span className="block font-display text-xl leading-none">{showTime(item.time)}</span>
                        <span className="text-xs text-primary">{formatWait(item.minutes - now.minutes)}</span>
                      </span>
                      <span className="grid h-7 min-w-10 place-items-center rounded-full px-2 text-xs font-semibold text-white" style={{ background: item.color }}>
                        {item.code}
                      </span>
                      <span className="min-w-0 text-sm">prema {item.headsign}</span>
                    </li>
                  ))}
                </ul>
              )}
              {serving.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {serving.map((line) => (
                    <Link key={line.id} href={`/linije/${line.id}?stop=${origin.id}`} className="rounded-full bg-muted px-3 py-2 text-sm">
                      Linija {line.code}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {destination && (
            <PlanResult
              key={`${originId}|${destId}|${planned.later}|${planned.items.map((item) => item.legs.map((leg) => leg.directionId).join(">")).join(";")}`}
              items={planned.items}
              later={planned.later}
              nowMinutes={now.minutes}
              drawn={drawn}
            />
          )}
        </>
      )}
    </main>
  );
}

function drawPlan(plan: Itinerary | undefined, lines: Line[]) {
  if (!plan) return null;
    const parts: { color: string; code: string; positions: [number, number][] }[] = [];
  const pins: { lat: number; lng: number; label: string }[] = [];
  for (const leg of plan.legs) {
    const direction = lines.find((line) => line.id === leg.lineId)?.directions.find((item) => item.id === leg.directionId);
    if (!direction) continue;
    const positions = legShape(direction, leg.originIndex, leg.destinationIndex);
    if (positions.length) parts.push({ color: leg.color, code: leg.code, positions });
    const origin = stopOnShape(direction, leg.originIndex);
    const destination = stopOnShape(direction, leg.destinationIndex);
    if (origin) pins.push({ lat: origin[0], lng: origin[1], label: leg.originName });
    if (destination) pins.push({ lat: destination[0], lng: destination[1], label: leg.destinationName });
  }
  const uniquePins = pins.filter((pin, index) => pins.findIndex((item) => item.label === pin.label) === index);
  return { parts, pins: uniquePins };
}

function PlanResult({
  items,
  later,
  nowMinutes,
  drawn,
}: {
  items: Itinerary[];
  later: boolean;
  nowMinutes: number;
  drawn: { parts: { color: string; code: string; positions: [number, number][] }[]; pins: { lat: number; lng: number; label: string }[] }[];
}) {
  const [active, setActive] = useState(0);
  const plan = items[Math.min(active, Math.max(0, items.length - 1))];
  if (!plan) {
    return (
      <section className="mt-3 rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="text-sm">Ovim danom nema izravne veze ni presjedanja između ta dva stajališta.</p>
      </section>
    );
  }
  const first = plan.legs[0];
  const wait = first.departMinutes - nowMinutes;
  const hasMap = drawn.some((route) => route.parts.length > 0);
  return (
    <section className="mt-3 overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10">
      <div className="p-4">
        {later && (
          <p className="mb-2 text-sm text-muted-foreground">Danas više nema polaska. Prvi ovim rasporedom:</p>
        )}
        <p className="text-xs text-muted-foreground">Sve rute od ovog trenutka. Odaberi jednu.</p>
        <ul className="mt-2 space-y-2">
          {items.map((item, index) => {
            const start = item.legs[0];
            const end = item.legs[item.legs.length - 1];
            const path = [start.originName, ...item.legs.map((leg) => leg.destinationName)].join(" → ");
            const chosen = item === plan;
            return (
              <li key={`${item.legs.map((leg) => leg.lineId).join("-")}-${start.depart}`}>
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  className={`w-full rounded-2xl px-3 py-2 text-left text-sm ${chosen ? "bg-accent ring-1 ring-foreground/15" : "bg-muted"}`}
                >
                  <span className="font-medium">{String.fromCharCode(65 + index)}</span>
                  <span className="text-muted-foreground"> · {item.transfers === 0 ? "bez presjedanja" : "presjedanje"}</span>
                  <span className="mt-0.5 block">{path}</span>
                  <span className="text-muted-foreground">
                    {item.legs.map((leg) => `Linija ${leg.code}`).join(" → ")} · {showTime(start.depart)}
                    {!later && ` · ${formatWait(start.departMinutes - nowMinutes)}`}
                    {" · "}dolazak {showTime(end.arrive)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="font-display mt-4 text-4xl leading-none">{later ? showTime(first.depart) : formatWait(wait)}</p>
        <ol className="mt-4 space-y-3">
          {plan.legs.map((leg, index) => {
            const previous = plan.legs[index - 1];
            const gap = previous ? Math.max(0, leg.departMinutes - previous.arriveMinutes - leg.walkMinutes) : 0;
            return (
              <li key={`${leg.directionId}-${leg.depart}-${leg.originStopId}`}>
                {index > 0 && (
                  <p className="mb-2 rounded-2xl bg-muted px-3 py-2 text-sm">
                    Presjedanje
                    {leg.walkMinutes > 0 ? ` · pješke ${leg.walkMinutes} min do ${leg.originName}` : ` u ${leg.originName}`}
                    {gap > 0 ? ` · čekanje ${gap} min` : ""}
                  </p>
                )}
                <div className="flex gap-3">
                  <span className="grid h-7 min-w-10 place-items-center rounded-full px-2 text-xs font-semibold text-white" style={{ background: leg.color }}>
                    {leg.code}
                  </span>
                  <div className="min-w-0 text-sm">
                    <p>
                      <span className="font-medium">{leg.originName}</span>{" "}
                      <span className="tabular-nums">{showTime(leg.depart)}</span>
                      {index === 0 && !later && <span className="text-primary"> · {formatWait(wait)}</span>}
                    </p>
                    <p className="text-muted-foreground">prema {leg.headsign}</p>
                    <p>
                      <span className="font-medium">{leg.destinationName}</span>{" "}
                      <span className="tabular-nums">{showTime(leg.arrive)}</span>
                    </p>
                    <Link href={`/linije/${leg.lineId}?stop=${leg.originStopId}`} className="mt-1 inline-block text-primary">
                      Linija {leg.code}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <Button className="mt-4 h-11 w-full" variant="outline" nativeButton={false} render={<Link href={`/karta?stop=${first.originStopId}&linija=${first.lineId}`} />}>
          <MapPinned className="size-4" />
          Otvori na karti
        </Button>
      </div>
      {hasMap && (
        <div className="border-t">
          {items.length > 1 && (
            <p className="px-4 pt-3 text-xs text-muted-foreground">Sve opcije su na karti. Dodirni liniju da je odabereš.</p>
          )}
          <RouteMap routes={drawn} active={Math.min(active, drawn.length - 1)} onSelect={setActive} />
        </div>
      )}
    </section>
  );
}
