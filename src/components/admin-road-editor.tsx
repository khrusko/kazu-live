"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import Link from "next/link";
import { MapContainer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import { Basemap, BasemapSwitch } from "@/components/basemap";
import { useKazu } from "@/components/providers";
import type { Direction } from "@/lib/types";
import "leaflet/dist/leaflet.css";

function pin(color: string) {
  return L.divIcon({
    className: "edit-pin",
    html: `<div style="width:16px;height:16px;border-radius:99px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function segmentsOf(direction: Direction): [number, number][][] {
  const shape = direction.shape?.length ? direction.shape : direction.geometry;
  const anchors =
    direction.shapeAnchors?.length === direction.stops.length
      ? direction.shapeAnchors
      : direction.geometry.map((_, index) => index);
  const parts: [number, number][][] = [];
  for (let index = 0; index < direction.stops.length - 1; index += 1) {
    const start = anchors[index] ?? index;
    const end = anchors[index + 1] ?? index + 1;
    const slice = shape.slice(Math.min(start, end), Math.max(start, end) + 1);
    parts.push(slice.length >= 2 ? slice : [direction.geometry[index], direction.geometry[index + 1]].filter(Boolean));
  }
  return parts;
}

function Fly({ point }: { point: [number, number] | null }) {
  const map = useMap();
  const key = point ? `${point[0]},${point[1]}` : "";
  useEffect(() => {
    if (!point) return;
    map.flyTo(point, Math.max(map.getZoom(), 14), { duration: 0.4 });
  }, [key, map, point]);
  return null;
}

function DrawClicks({
  enabled,
  skip,
  onPoint,
}: {
  enabled: boolean;
  skip: MutableRefObject<boolean>;
  onPoint: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      if (skip.current) {
        skip.current = false;
        return;
      }
      onPoint(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export function AdminRoadEditor() {
  const { user, network, loading, refresh } = useKazu();
  const [lineId, setLineId] = useState("");
  const [directionId, setDirectionId] = useState("");
  const [segment, setSegment] = useState<number | null>(null);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [satellite, setSatellite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [overrides, setOverrides] = useState<Record<string, [number, number]>>({});
  const skip = useRef(false);

  const line = network?.lines.find((item) => item.id === lineId) ?? network?.lines[0] ?? null;
  const direction = line?.directions.find((item) => item.id === directionId) ?? line?.directions[0] ?? null;
  const parts = useMemo(() => (direction ? segmentsOf(direction) : []), [direction]);

  if (loading) return <p className="p-8 text-sm">Učitavam…</p>;
  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl">Stajališta i ceste</h1>
        <p className="mt-2 text-sm">Ovo može samo dispečer.</p>
        <Link href="/prijava?next=/admin/karta" className="mt-3 inline-block text-sm text-primary">
          Prijava
        </Link>
      </div>
    );
  }
  if (!line || !direction) return <p className="p-8 text-sm">Nema linija.</p>;

  const activeLine = line.id === lineId || !lineId ? line : line;
  const fromName =
    segment != null ? network?.stops.find((stop) => stop.id === direction.stops[segment]?.stopId)?.name : "";
  const toName =
    segment != null ? network?.stops.find((stop) => stop.id === direction.stops[segment + 1]?.stopId)?.name : "";

  function chooseLine(id: string) {
    setLineId(id);
    setDirectionId("");
    setSegment(null);
    setDraft([]);
  }

  function chooseDirection(id: string) {
    setDirectionId(id);
    setSegment(null);
    setDraft([]);
  }

  function chooseSegment(index: number) {
    skip.current = true;
    setSegment(index);
    setDraft([]);
  }

  async function saveStop(id: string, lat: number, lng: number) {
    setOverrides((current) => ({ ...current, [id]: [lat, lng] }));
    setBusy(true);
    try {
      const response = await fetch("/api/admin/stops", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, lat, lng }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Spremanje nije uspjelo.");
      toast.success("Stajalište je na novom mjestu.");
      await refresh();
      setOverrides((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Spremanje nije uspjelo.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRoad() {
    if (segment == null || draft.length < 1) {
      toast.error("Klikni po karti kuda ide cesta između ta dva stajališta.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/segments", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directionId: direction?.id, fromIndex: segment, points: draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cesta nije spremljena.");
      setDraft([]);
      setSegment(null);
      toast.success("Cesta između stajališta je spremljena.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cesta nije spremljena.");
    } finally {
      setBusy(false);
    }
  }

  const drawn =
    segment != null && draft.length
      ? [parts[segment]?.[0], ...draft, parts[segment]?.[parts[segment].length - 1]].filter(Boolean)
      : null;

  return (
    <div className="flex h-full min-h-[420px] flex-col lg:flex-row">
      <aside className="flex max-h-[46%] w-full shrink-0 flex-col border-b bg-background lg:max-h-none lg:w-[380px] lg:border-r lg:border-b-0">
        <div className="border-b px-4 py-3">
          <Link href="/admin" className="text-xs text-muted-foreground">
            Dispečer
          </Link>
          <h1 className="font-display text-2xl">Stajališta i ceste</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Povuci stajalište na pravo mjesto. Za cestu odaberi dionicu i klikaj po karti kuda autobus ide. Drugi smjer se uređuje zasebno.
          </p>
          <label className="mt-3 block text-xs text-muted-foreground">
            Linija
            <select
              className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm text-foreground"
              value={activeLine.id}
              onChange={(event) => chooseLine(event.target.value)}
            >
              {network?.lines.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 block text-xs text-muted-foreground">
            Smjer
            <select
              className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm text-foreground"
              value={direction.id}
              onChange={(event) => chooseDirection(event.target.value)}
            >
              {activeLine.directions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {segment != null && (
            <div className="mt-3 rounded-xl bg-muted p-2 text-sm">
              <p>
                Cesta: {fromName} → {toName}
              </p>
              <p className="text-xs text-muted-foreground">{draft.length ? `${draft.length} točaka na karti` : "Klikni po cesti."}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground" disabled={busy} onClick={saveRoad}>
                  Spremi cestu
                </button>
                <button
                  type="button"
                  className="rounded-full bg-background px-3 py-1.5 text-xs"
                  onClick={() => {
                    setDraft([]);
                    setSegment(null);
                  }}
                >
                  Odustani
                </button>
              </div>
            </div>
          )}
        </div>
        <ul className="min-h-0 flex-1 overflow-auto px-2 py-2">
          {direction.stops.map((call, index) => {
            const named = network?.stops.find((stop) => stop.id === call.stopId);
            const at = overrides[call.stopId] ?? (named ? [named.lat, named.lng] : null);
            return (
              <li key={`${call.stopId}-${index}`}>
                <button
                  type="button"
                  className="flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => at && setFocus([at[0], at[1]])}
                >
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">{call.km}</span>
                  <span className="truncate">{named?.name ?? call.stopId}</span>
                </button>
                {index < direction.stops.length - 1 && (
                  <button
                    type="button"
                    className={`mb-1 ml-12 rounded-full px-2 py-0.5 text-[11px] ${segment === index ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    onClick={() => chooseSegment(index)}
                  >
                    Uredi cestu do sljedećeg
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </aside>
      <div className="relative min-h-[320px] flex-1">
        <MapContainer center={[45.4, 15.55]} zoom={10} className="h-full w-full" scrollWheelZoom fadeAnimation={false}>
          <Basemap satellite={satellite} />
          <Fly point={focus} />
          <DrawClicks enabled={segment != null && !busy} skip={skip} onPoint={(lat, lng) => setDraft((current) => [...current, [lat, lng]])} />
          {parts.map((positions, index) =>
            segment === index && drawn ? null : (
              <Polyline
                key={`${direction.id}-${index}`}
                positions={positions}
                pathOptions={{ color: segment === index ? "#b45309" : activeLine.color, weight: segment === index ? 7 : 5, opacity: 0.9 }}
                eventHandlers={{ click: () => chooseSegment(index) }}
              />
            ),
          )}
          {drawn && <Polyline positions={drawn as [number, number][]} pathOptions={{ color: "#b45309", weight: 6 }} />}
          {draft.map((point, index) => (
            <Marker key={`draft-${index}`} position={point} icon={pin("#b45309")} />
          ))}
          {direction.stops.map((call, index) => {
            const named = network?.stops.find((stop) => stop.id === call.stopId);
            if (!named) return null;
            const at = overrides[call.stopId] ?? [named.lat, named.lng];
            return (
              <Marker
                key={`${call.stopId}-${index}`}
                position={at}
                icon={pin(segment === index || segment === index - 1 ? "#b45309" : "#0f766e")}
                draggable={!busy}
                zIndexOffset={400}
                eventHandlers={{
                  dragend: (event) => {
                    const latlng = event.target.getLatLng();
                    void saveStop(call.stopId, latlng.lat, latlng.lng);
                  },
                }}
              />
            );
          })}
        </MapContainer>
        <BasemapSwitch satellite={satellite} onChange={setSatellite} />
      </div>
    </div>
  );
}
