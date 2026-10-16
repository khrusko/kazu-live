"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { Heart, LocateFixed, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKazu } from "@/components/providers";
import { departuresForStop, GROUP_LABEL, linesAtStop, liveBuses } from "@/lib/schedule";
import { DAY_LABEL, showTime, zagrebParts } from "@/lib/time";
import type { Line, Stop } from "@/lib/types";
import "leaflet/dist/leaflet.css";

type Point = { id: string; lat: number; lng: number; name: string };

function busIcon(code: string, color: string) {
  return L.divIcon({
    className: "bus-pin",
    html: `<span style="background:${color}">${code}</span>`,
    iconSize: [44, 22],
    iconAnchor: [22, 11],
  });
}

function FlyTo({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 13), { duration: 0.55 });
  }, [lat, lng, map]);
  return null;
}

function FitLine({ lineId, points }: { lineId: string; points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(points, { padding: [40, 40] });
    // Fit only when the chosen line changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId, map]);
  return null;
}

export function MapApp() {
  const { network, loading, error, favoriteLineIds, favoriteStopIds, toggleLine, toggleStop } = useKazu();
  const params = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => zagrebParts());
  const [showBuses, setShowBuses] = useState(true);
  const lineId = params.get("linija");
  const stopId = params.get("stop");

  useEffect(() => {
    const timer = setInterval(() => setNow(zagrebParts()), 15000);
    return () => clearInterval(timer);
  }, []);

  const stops = network?.stops ?? [];
  const lines = network?.lines ?? [];
  const selectedLine = lines.find((line) => line.id === lineId) ?? null;
  const selectedStop = stops.find((stop) => stop.id === stopId) ?? null;

  const departures = useMemo(
    () => (selectedStop ? departuresForStop(lines, stops, selectedStop.id, now.day) : []),
    [selectedStop, lines, stops, now.day],
  );
  const upcoming = departures.filter((item) => item.minutes >= now.minutes);
  const passed = departures.filter((item) => item.minutes < now.minutes);
  const serving = selectedStop ? linesAtStop(lines, selectedStop.id) : [];

  const buses = useMemo(
    () => (showBuses ? liveBuses(selectedLine ? [selectedLine] : lines, stops, now.day, now.minutes) : []),
    [showBuses, selectedLine, lines, stops, now.day, now.minutes],
  );

  function setQueryParams(next: { stop?: string | null; linija?: string | null }) {
    const search = new URLSearchParams(params.toString());
    if (next.stop === null) search.delete("stop");
    else if (next.stop) search.set("stop", next.stop);
    if (next.linija === null) search.delete("linija");
    else if (next.linija) search.set("linija", next.linija);
    const text = search.toString();
    router.replace(text ? `/?${text}` : "/", { scroll: false });
  }

  const visibleLines = selectedLine ? [selectedLine] : lines;
  const linePoints: [number, number][] = selectedLine
    ? selectedLine.directions.flatMap((direction) => direction.geometry)
    : [];

  const markers: Point[] = useMemo(() => {
    if (selectedLine) {
      const seen = new Set<string>();
      const list: Point[] = [];
      for (const direction of selectedLine.directions) {
        direction.stops.forEach((stop, index) => {
          if (seen.has(stop.stopId)) return;
          const geometry = direction.geometry[index];
          const named = stops.find((item) => item.id === stop.stopId);
          if (!geometry || !named) return;
          seen.add(stop.stopId);
          list.push({ id: named.id, lat: geometry[0], lng: geometry[1], name: named.name });
        });
      }
      return list;
    }
    const buckets = new Map<string, number>();
    return stops
      .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
      .map((stop) => {
        const key = `${stop.lat.toFixed(3)}:${stop.lng.toFixed(3)}`;
        const index = buckets.get(key) ?? 0;
        buckets.set(key, index + 1);
        const angle = index * 1.15;
        const radius = index === 0 ? 0 : 0.00045 * index;
        return {
          id: stop.id,
          name: stop.name,
          lat: stop.lat + Math.sin(angle) * radius,
          lng: stop.lng + Math.cos(angle) * radius,
        };
      });
  }, [selectedLine, stops]);

  const q = query.trim().toLowerCase();
  const stopHits = q.length < 2 ? [] : stops.filter((stop) => stop.name.toLowerCase().includes(q)).slice(0, 7);
  const lineHits = q.length < 1 ? [] : lines.filter((line) => `${line.code} ${line.name}`.toLowerCase().includes(q)).slice(0, 5);

  async function onHeart(kind: "line" | "stop", id: string) {
    try {
      if (kind === "line") await toggleLine(id);
      else await toggleStop(id);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Favorit nije spremljen.");
    }
  }

  if (loading) {
    return <div className="grid h-[calc(100dvh-3.5rem)] place-items-center text-sm text-muted-foreground">Učitavam kartu i vozni red…</div>;
  }
  if (error || !network) {
    return <div className="grid h-[calc(100dvh-3.5rem)] place-items-center px-6 text-center text-sm">{error || "Nema podataka."}</div>;
  }

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] min-h-[560px]">
      <div className="absolute inset-0 lg:left-[390px]">
        <MapContainer center={[45.4, 15.55]} zoom={10} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; OpenStreetMap &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {visibleLines.map((line) =>
            line.directions.map((direction) => (
              <Polyline
                key={direction.id}
                positions={direction.geometry}
                pathOptions={{ color: line.color, weight: selectedLine ? 5 : 3, opacity: selectedLine ? 0.9 : 0.72 }}
              />
            )),
          )}
          {markers.map((marker) => (
            <CircleMarker
              key={marker.id}
              center={[marker.lat, marker.lng]}
              radius={marker.id === stopId ? 8 : 5}
              pathOptions={{
                color: marker.id === stopId ? "#1c1915" : "#ffffff",
                weight: 2,
                fillColor: selectedLine?.color ?? "#0f6e56",
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => setQueryParams({ stop: marker.id }) }}
            >
              <Tooltip>{marker.name}</Tooltip>
            </CircleMarker>
          ))}
          {buses.map((bus) => (
            <Marker key={bus.id} position={[bus.lat, bus.lng]} icon={busIcon(bus.code, bus.color)}>
              <Tooltip>
                {bus.code} prema {bus.headsign}
                <br />
                {bus.from} → {bus.to}
              </Tooltip>
            </Marker>
          ))}
          <FlyTo lat={selectedStop?.lat ?? null} lng={selectedStop?.lng ?? null} />
          {selectedLine && !selectedStop && <FitLine lineId={selectedLine.id} points={linePoints} />}
        </MapContainer>
      </div>

      <aside className="absolute inset-x-0 bottom-0 z-20 flex max-h-[68%] flex-col rounded-t-3xl bg-card shadow-[0_-12px_40px_rgba(30,40,30,0.18)] ring-1 ring-foreground/10 lg:inset-y-0 lg:left-0 lg:max-h-none lg:w-[390px] lg:rounded-none">
        <div className="border-b px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Stajalište ili linija, npr. Ogulin"
              className="h-9 pl-8"
            />
          </div>
          {(stopHits.length > 0 || lineHits.length > 0) && (
            <div className="mt-2 max-h-48 overflow-auto rounded-xl bg-muted p-1">
              {lineHits.map((line) => (
                <button
                  key={line.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-background"
                  onClick={() => {
                    setQuery("");
                    setQueryParams({ linija: line.id, stop: null });
                  }}
                >
                  <Badge style={{ background: line.color }} className="text-white">{line.code}</Badge>
                  <span className="truncate">{line.name}</span>
                </button>
              ))}
              {stopHits.map((stop) => (
                <button
                  key={stop.id}
                  type="button"
                  className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-background"
                  onClick={() => {
                    setQuery("");
                    setQueryParams({ stop: stop.id });
                  }}
                >
                  {stop.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {now.dateLabel} {now.clock} · {DAY_LABEL[now.day]}
            </span>
            <button type="button" className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1" onClick={() => setShowBuses((value) => !value)}>
              <LocateFixed className="size-3" />
              {showBuses ? `${buses.length} u vožnji` : "Autobusi skriveni"}
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {selectedStop ? (
            <StopDetail
              stop={selectedStop}
              serving={serving}
              upcoming={upcoming.slice(0, 8)}
              passedCount={passed.length}
              favorite={favoriteStopIds.includes(selectedStop.id)}
              favoriteLines={favoriteLineIds}
              onClose={() => setQueryParams({ stop: null })}
              onLine={(id) => setQueryParams({ linija: id })}
              onHeart={() => onHeart("stop", selectedStop.id)}
              onHeartLine={(id) => onHeart("line", id)}
            />
          ) : (
            <LineList
              lines={lines}
              activeId={lineId}
              favorites={favoriteLineIds}
              onPick={(id) => setQueryParams({ linija: id === lineId ? null : id, stop: null })}
              onHeart={(id) => onHeart("line", id)}
            />
          )}
        </div>
        <p className="border-t px-4 py-2 text-[11px] leading-snug text-muted-foreground">
          Položaj autobusa je procjena iz voznog reda, ne GPS. Stajališta su približno smještena prema nazivu i kilometraži.
        </p>
      </aside>
    </div>
  );
}

function LineList({
  lines,
  activeId,
  favorites,
  onPick,
  onHeart,
}: {
  lines: Line[];
  activeId: string | null;
  favorites: string[];
  onPick: (id: string) => void;
  onHeart: (id: string) => void;
}) {
  const groups = ["A", "B", "C", "D", "E"];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl">Mreža linija</h1>
        {activeId && (
          <button type="button" className="text-xs text-primary" onClick={() => onPick(activeId)}>
            Prikaži sve
          </button>
        )}
      </div>
      {groups.map((group) => {
        const items = lines.filter((line) => line.group === group);
        if (!items.length) return null;
        return (
          <section key={group}>
            <h2 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {GROUP_LABEL[group]}
            </h2>
            <ul className="space-y-1">
              {items.map((line) => (
                <li key={line.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${activeId === line.id ? "bg-muted" : ""}`}>
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onPick(line.id)}>
                    <span className="grid h-6 min-w-9 place-items-center rounded-full px-1.5 text-[11px] font-semibold text-white" style={{ background: line.color }}>
                      {line.code}
                    </span>
                    <span className="truncate text-sm">{line.name}</span>
                  </button>
                  <button type="button" aria-label="Favorit" onClick={() => onHeart(line.id)} className="grid size-7 place-items-center">
                    <Heart className={`size-4 ${favorites.includes(line.id) ? "fill-current text-[oklch(0.55_0.16_35)]" : "text-muted-foreground"}`} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function StopDetail({
  stop,
  serving,
  upcoming,
  passedCount,
  favorite,
  favoriteLines,
  onClose,
  onLine,
  onHeart,
  onHeartLine,
}: {
  stop: Stop;
  serving: Line[];
  upcoming: ReturnType<typeof departuresForStop>;
  passedCount: number;
  favorite: boolean;
  favoriteLines: string[];
  onClose: () => void;
  onLine: (id: string) => void;
  onHeart: () => void;
  onHeartLine: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Stajalište</p>
          <h1 className="font-display text-2xl leading-tight">{stop.name}</h1>
        </div>
        <div className="flex gap-1">
          <button type="button" aria-label="Favorit stajališta" onClick={onHeart} className="grid size-8 place-items-center rounded-full bg-muted">
            <Heart className={`size-4 ${favorite ? "fill-current text-[oklch(0.55_0.16_35)]" : ""}`} />
          </button>
          <button type="button" onClick={onClose} className="rounded-full bg-muted px-2 text-xs">
            Zatvori
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {serving.map((line) => (
          <button key={line.id} type="button" onClick={() => onLine(line.id)} className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-2 text-xs">
            <span className="font-semibold" style={{ color: line.color }}>{line.code}</span>
            <Heart
              className={`size-3 ${favoriteLines.includes(line.id) ? "fill-current text-[oklch(0.55_0.16_35)]" : "text-muted-foreground"}`}
              onClick={(event) => {
                event.stopPropagation();
                onHeartLine(line.id);
              }}
            />
          </button>
        ))}
      </div>
      <h2 className="mt-4 text-sm font-medium">Sljedeći polasci danas</h2>
      {upcoming.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {passedCount ? "Današnji polasci s ovog stajališta su prošli." : "Danas nema polazaka u ovom rasporedu."}
        </p>
      ) : (
        <ul className="mt-2 divide-y">
          {upcoming.map((item) => (
            <li key={`${item.tripId}-${item.time}-${item.directionId}`} className="flex items-center gap-3 py-2">
              <span className="w-12 font-display text-lg">{showTime(item.time)}</span>
              <span className="grid h-6 min-w-9 place-items-center rounded-full px-1.5 text-[11px] font-semibold text-white" style={{ background: item.color }}>
                {item.code}
              </span>
              <span className="min-w-0 truncate text-sm">prema {item.headsign}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="lg" render={<Link href={`/karte?od=${stop.id}`} />}>Karta odavde</Button>
        {serving[0] && (
          <Button size="lg" variant="outline" render={<Link href={`/linije/${serving[0].id}`} />}>
            Cijeli red
          </Button>
        )}
      </div>
    </div>
  );
}
