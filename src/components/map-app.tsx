"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleMarker, MapContainer, Marker, Polyline, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { ChevronDown, Heart, LocateFixed, Search } from "lucide-react";
import { Basemap, BasemapSwitch } from "@/components/basemap";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKazu } from "@/components/providers";
import { SALES_POINTS, type SalesPoint } from "@/lib/fares";
import { departuresForStop, GROUP_LABEL, linesAtStop, liveBuses, stopOnShape } from "@/lib/schedule";
import { DAY_LABEL, formatWait, showTime, zagrebParts } from "@/lib/time";
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

function officeIcon() {
  return L.divIcon({
    className: "office-pin",
    html: "<span>Blagajna</span>",
    iconSize: [78, 22],
    iconAnchor: [39, 11],
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
  const [satellite, setSatellite] = useState(false);
  const lineId = params.get("linija");
  const stopId = params.get("stop");
  const officeId = params.get("blagajna");

  useEffect(() => {
    const timer = setInterval(() => setNow(zagrebParts()), 15000);
    return () => clearInterval(timer);
  }, []);

  const stops = network?.stops ?? [];
  const lines = network?.lines ?? [];
  const selectedLine = lines.find((line) => line.id === lineId) ?? null;
  const selectedStop = stops.find((stop) => stop.id === stopId) ?? null;
  const selectedOffice = SALES_POINTS.find((point) => point.id === officeId) ?? null;

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
    else if (next.stop) {
      search.set("stop", next.stop);
      search.delete("blagajna");
    }
    if (next.linija === null) search.delete("linija");
    else if (next.linija) search.set("linija", next.linija);
    const text = search.toString();
    router.replace(text ? `/karta?${text}` : "/karta", { scroll: false });
  }

  function openOffice(id: string | null) {
    const search = new URLSearchParams(params.toString());
    if (id) {
      search.set("blagajna", id);
      search.delete("stop");
    } else {
      search.delete("blagajna");
    }
    const text = search.toString();
    router.replace(text ? `/karta?${text}` : "/karta", { scroll: false });
  }

  const visibleLines = selectedLine ? [selectedLine] : lines;
  const linePoints: [number, number][] = selectedLine
    ? selectedLine.directions.flatMap((direction) => (direction.shape?.length ? direction.shape : direction.geometry))
    : [];

  const markers: Point[] = useMemo(() => {
    if (selectedLine) {
      const seen = new Set<string>();
      const list: Point[] = [];
      for (const direction of selectedLine.directions) {
        direction.stops.forEach((stop, index) => {
          if (seen.has(stop.stopId)) return;
          const geometry = stopOnShape(direction, index);
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
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Učitavam kartu i vozni red…</div>;
  }
  if (error || !network) {
    return <div className="grid h-full place-items-center px-6 text-center text-sm">{error || "Nema podataka."}</div>;
  }

  return (
    <div className="relative h-full min-h-[420px]">
      <div className="absolute inset-0 lg:left-[390px]">
        <MapContainer center={[45.4, 15.55]} zoom={10} className="h-full w-full" scrollWheelZoom fadeAnimation={false}>
          <Basemap satellite={satellite} />
          <LineBadges lines={visibleLines} />
          {visibleLines.map((line) =>
            line.directions.map((direction) => (
              <Polyline
                key={direction.id}
                positions={direction.shape?.length ? direction.shape : direction.geometry}
                pathOptions={{ color: line.color, weight: selectedLine ? 5 : 3, opacity: selectedLine ? 0.9 : 0.55 }}
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
          {SALES_POINTS.map((point) => (
            <Marker
              key={point.id}
              position={[point.lat, point.lng]}
              icon={officeIcon()}
              zIndexOffset={400}
              eventHandlers={{ click: () => openOffice(point.id) }}
            >
              <Tooltip>{point.place}</Tooltip>
            </Marker>
          ))}
          {buses.map((bus) => (
            <CircleMarker
              key={bus.id}
              center={[bus.lat, bus.lng]}
              radius={6}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: bus.color, fillOpacity: 1 }}
            >
              <Tooltip>
                {bus.code} prema {bus.headsign}
                <br />
                {bus.from} → {bus.to}
              </Tooltip>
            </CircleMarker>
          ))}
          <FlyTo lat={selectedStop?.lat ?? selectedOffice?.lat ?? null} lng={selectedStop?.lng ?? selectedOffice?.lng ?? null} />
          {selectedLine && !selectedStop && <FitLine lineId={selectedLine.id} points={linePoints} />}
        </MapContainer>
        <BasemapSwitch satellite={satellite} onChange={setSatellite} className="absolute top-3 right-3 z-[500]" />
      </div>

      <aside className="absolute inset-x-0 bottom-0 z-20 flex max-h-[52%] flex-col rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(30,40,30,0.18)] ring-1 ring-foreground/10 sm:max-h-[58%] lg:inset-y-0 lg:left-0 lg:max-h-none lg:w-[390px] lg:rounded-none lg:pb-0">
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
              nowMinutes={now.minutes}
              passedCount={passed.length}
              favorite={favoriteStopIds.includes(selectedStop.id)}
              favoriteLines={favoriteLineIds}
              onClose={() => setQueryParams({ stop: null })}
              onLine={(id) => setQueryParams({ linija: id })}
              onHeart={() => onHeart("stop", selectedStop.id)}
              onHeartLine={(id) => onHeart("line", id)}
            />
          ) : selectedOffice ? (
            <OfficeDetail office={selectedOffice} onClose={() => openOffice(null)} />
          ) : (
            <LineList
              lines={lines}
              activeId={lineId}
              favorites={favoriteLineIds}
              onPick={(id) => setQueryParams({ linija: id === lineId ? null : id, stop: null })}
              onHeart={(id) => onHeart("line", id)}
              onOffice={openOffice}
            />
          )}
        </div>
        <p className="border-t px-4 py-2 text-[11px] leading-snug text-muted-foreground">
          Stajališta u Karlovcu preuzeta su s GIS-a Grada Karlovca. Ostala su postavljena uz cestu službene linije.
        </p>
      </aside>
    </div>
  );
}

const BADGE_LIMIT = 8;

function clipSegment(bounds: L.LatLngBounds, a: [number, number], b: [number, number]): [number, number] | null {
  const west = bounds.getWest();
  const east = bounds.getEast();
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  let t0 = 0;
  let t1 = 1;
  const x0 = a[1];
  const y0 = a[0];
  const dx = b[1] - x0;
  const dy = b[0] - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - west, east - x0, y0 - south, north - y0];
  for (let edge = 0; edge < 4; edge += 1) {
    if (p[edge] === 0) {
      if (q[edge] < 0) return null;
      continue;
    }
    const t = q[edge] / p[edge];
    if (p[edge] < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  const t = (t0 + t1) / 2;
  return [y0 + dy * t, x0 + dx * t];
}

function lineHits(line: Line, bounds: L.LatLngBounds): [number, number][] {
  const hits: [number, number][] = [];
  for (const direction of line.directions) {
    const path = direction.shape?.length ? direction.shape : direction.geometry;
    for (let index = 0; index < path.length - 1; index += 1) {
      const hit = clipSegment(bounds, path[index], path[index + 1]);
      if (hit) hits.push(hit);
    }
  }
  if (hits.length <= 24) return hits;
  const step = Math.ceil(hits.length / 24);
  return hits.filter((_, index) => index % step === 0);
}

function LineBadges({ lines }: { lines: Line[] }) {
  const map = useMap();
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const [badges, setBadges] = useState<{ id: string; code: string; color: string; lat: number; lng: number }[]>([]);

  const place = useCallback(() => {
    const current = linesRef.current;
    const bounds = map.getBounds();
    const size = map.getSize();
    const center = map.latLngToContainerPoint(map.getCenter());
    const visible: { line: Line; candidates: [number, number][] }[] = [];
    for (const line of current) {
      const candidates = lineHits(line, bounds);
      if (candidates.length) visible.push({ line, candidates });
    }
    // One chip per line, and only while a handful of lines actually cross the view.
    // A chosen line always keeps its chip, even if the county is otherwise busy.
    if (current.length !== 1 && visible.length > BADGE_LIMIT) {
      setBadges((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const placed: L.Point[] = [];
    const next: { id: string; code: string; color: string; lat: number; lng: number }[] = [];
    for (const { line, candidates } of visible) {
      const ranked = candidates
        .map((point) => {
          const pixel = map.latLngToContainerPoint(point);
          const margin = Math.min(pixel.x, pixel.y, size.x - pixel.x, size.y - pixel.y);
          return { point, pixel, score: margin - pixel.distanceTo(center) * 0.2 };
        })
        .sort((a, b) => b.score - a.score);
      let choice = ranked[0];
      for (const candidate of ranked) {
        if (placed.every((pixel) => pixel.distanceTo(candidate.pixel) >= 48)) {
          choice = candidate;
          break;
        }
      }
      if (!choice) continue;
      placed.push(choice.pixel);
      next.push({ id: line.id, code: line.code, color: line.color, lat: choice.point[0], lng: choice.point[1] });
    }
    setBadges((prev) => {
      if (
        prev.length === next.length &&
        prev.every((item, index) => item.id === next[index].id && item.lat === next[index].lat && item.lng === next[index].lng)
      ) {
        return prev;
      }
      return next;
    });
  }, [map]);

  useMapEvents({ moveend: place, zoomend: place });
  useEffect(() => {
    place();
  }, [place, lines]);

  return badges.map((badge) => (
    <Marker key={badge.id} position={[badge.lat, badge.lng]} icon={busIcon(badge.code, badge.color)} zIndexOffset={350} interactive={false} />
  ));
}

function LineList({
  lines,
  activeId,
  favorites,
  onPick,
  onHeart,
  onOffice,
}: {
  lines: Line[];
  activeId: string | null;
  favorites: string[];
  onPick: (id: string) => void;
  onHeart: (id: string) => void;
  onOffice: (id: string) => void;
}) {
  const groups = ["A", "B", "C", "D", "E"];
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return (
    <div className="space-y-3">
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
        const open = !closed[group];
        return (
          <section key={group}>
            <button
              type="button"
              className="mb-1 flex w-full items-center justify-between gap-2 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase"
              aria-expanded={open}
              onClick={() => setClosed((value) => ({ ...value, [group]: !value[group] }))}
            >
              {GROUP_LABEL[group]}
              <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
            </button>
            {open && <ul className="space-y-1">
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
            </ul>}
          </section>
        );
      })}
      <section>
        <h2 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Blagajne</h2>
        <ul className="space-y-1">
          {SALES_POINTS.map((point) => (
            <li key={point.id}>
              <button type="button" className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-muted" onClick={() => onOffice(point.id)}>
                <span className="office-chip shrink-0">Blagajna</span>
                <span className="min-w-0">
                  <span className="block text-sm">{point.place}</span>
                  <span className="block text-xs text-muted-foreground">{point.hours}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function OfficeDetail({ office, onClose }: { office: SalesPoint; onClose: () => void }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Blagajna</p>
          <h1 className="font-display text-2xl leading-tight">{office.place}</h1>
        </div>
        <button type="button" onClick={onClose} className="rounded-full bg-muted px-2 py-1 text-xs">
          Zatvori
        </button>
      </div>
      <p className="mt-3 text-sm">{office.address}</p>
      <p className="mt-2 text-sm text-muted-foreground">{office.hours}</p>
      <p className="mt-3 text-xs text-muted-foreground">Radno vrijeme je sa stranice cijena na kazup.hr.</p>
    </div>
  );
}

function StopDetail({
  stop,
  serving,
  upcoming,
  nowMinutes,
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
  nowMinutes: number;
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
              <span className="w-14 shrink-0">
                <span className="block font-display text-lg leading-none">{showTime(item.time)}</span>
                <span className="text-[11px] text-primary">{formatWait(item.minutes - nowMinutes)}</span>
              </span>
              <span className="grid h-6 min-w-9 place-items-center rounded-full px-1.5 text-[11px] font-semibold text-white" style={{ background: item.color }}>
                {item.code}
              </span>
              <span className="min-w-0 truncate text-sm">prema {item.headsign}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {serving.map((line) => (
          <Button key={line.id} size="lg" variant="outline" nativeButton={false} render={<Link href={`/linije/${line.id}?stop=${stop.id}`} />}>
            Linija {line.code}
          </Button>
        ))}
      </div>
    </div>
  );
}
