"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MapContainer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import { Basemap, BasemapSwitch } from "@/components/basemap";
import { useKazu } from "@/components/providers";
import type { Direction } from "@/lib/types";
import "leaflet/dist/leaflet.css";

type LatLng = [number, number];

function nodeIcon(kind: "stop" | "node" | "selected") {
  const size = kind === "node" ? 12 : 18;
  const color = kind === "selected" ? "#b45309" : kind === "stop" ? "#0f766e" : "#1c1915";
  return L.divIcon({
    className: "edit-pin",
    html: `<div style="width:${size}px;height:${size}px;border-radius:99px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function shapeOf(direction: Direction): { points: LatLng[]; anchors: number[] } {
  const points = (direction.shape?.length ? direction.shape : direction.geometry).map((point) => [point[0], point[1]] as LatLng);
  const anchors =
    direction.shapeAnchors?.length === direction.stops.length ? direction.shapeAnchors.slice() : points.map((_, index) => index);
  return { points, anchors };
}

function dist2(a: LatLng, b: LatLng) {
  const dlat = a[0] - b[0];
  const dlng = (a[1] - b[1]) * Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
  return dlat * dlat + dlng * dlng;
}

function closestSegment(points: LatLng[], lat: number, lng: number) {
  const point: LatLng = [lat, lng];
  let best = 0;
  let bestD = Infinity;
  for (let index = 0; index < points.length - 1; index += 1) {
    const distance = dist2(point, points[index]) + dist2(point, points[index + 1]);
    if (distance < bestD) {
      bestD = distance;
      best = index;
    }
  }
  return best;
}

function FitShape({ points, id }: { points: LatLng[]; id: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) map.fitBounds(points, { padding: [28, 28] });
    // Fit when the direction changes, not after every vertex drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, map]);
  return null;
}

function Vertices({
  points,
  anchors,
  selected,
  busy,
  onSelect,
  onMove,
}: {
  points: LatLng[];
  anchors: number[];
  selected: number | null;
  busy: boolean;
  onSelect: (index: number) => void;
  onMove: (index: number, lat: number, lng: number) => void;
}) {
  const map = useMap();
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({
    moveend(event) {
      setBounds(event.target.getBounds());
      setZoom(event.target.getZoom());
    },
    zoomend(event) {
      setBounds(event.target.getBounds());
      setZoom(event.target.getZoom());
    },
  });
  useEffect(() => {
    setBounds(map.getBounds());
    setZoom(map.getZoom());
  }, [map, points]);

  const anchorSet = useMemo(() => new Set(anchors), [anchors]);
  const visible = points
    .map((point, index) => ({ point, index }))
    .filter(({ point, index }) => {
      if (index === selected || anchorSet.has(index)) return true;
      if (zoom < 13 || !bounds) return false;
      return bounds.contains([point[0], point[1]]);
    })
    .slice(0, 400);

  return (
    <>
      {visible.map(({ point, index }) => {
        const kind = index === selected ? "selected" : anchorSet.has(index) ? "stop" : "node";
        return (
          <Marker
            key={`${index}-${kind}`}
            position={point}
            icon={nodeIcon(kind)}
            draggable={!busy}
            zIndexOffset={kind === "node" ? 300 : 500}
            eventHandlers={{
              click: (event) => {
                L.DomEvent.stopPropagation(event.originalEvent);
                onSelect(index);
              },
              dragend: (event) => {
                const latlng = event.target.getLatLng();
                onMove(index, latlng.lat, latlng.lng);
              },
            }}
          />
        );
      })}
    </>
  );
}

export function AdminRoadEditor() {
  const { user, network, loading, refresh } = useKazu();
  const [lineId, setLineId] = useState("");
  const [directionId, setDirectionId] = useState("");
  const [draftShape, setDraftShape] = useState<LatLng[]>([]);
  const [draftAnchors, setDraftAnchors] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [busy, setBusy] = useState(false);
  const skip = useRef(false);

  const line = network?.lines.find((item) => item.id === lineId) ?? network?.lines[0] ?? null;
  const direction = line?.directions.find((item) => item.id === directionId) ?? line?.directions[0] ?? null;
  const activeDirectionId = direction?.id ?? "";

  useEffect(() => {
    if (!direction) return;
    const next = shapeOf(direction);
    setDraftShape(next.points);
    setDraftAnchors(next.anchors);
    setSelected(null);
    setDirty(false);
    // Reload the line only when the direction changes. A stop save must not wipe unsaved vertices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDirectionId]);

  if (loading) return <p className="p-8 text-sm">Učitavam…</p>;
  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl">Stajališta i ceste</h1>
        <p className="mt-2 text-sm">Ovo može samo administrator.</p>
        <Link href="/prijava?next=/admin/karta" className="mt-3 inline-block text-sm text-primary">
          Prijava
        </Link>
      </div>
    );
  }
  if (!line || !direction) return <p className="p-8 text-sm">Nema linija.</p>;

  const anchorSet = new Set(draftAnchors);
  const selectedIsStop = selected != null && anchorSet.has(selected);
  const selectedStop =
    selectedIsStop && selected != null
      ? network?.stops.find((stop) => stop.id === direction.stops[draftAnchors.indexOf(selected)]?.stopId)
      : null;

  function chooseLine(id: string) {
    setLineId(id);
    setDirectionId("");
  }

  function chooseDirection(id: string) {
    setDirectionId(id);
  }

  function revert() {
    if (!direction) return;
    const next = shapeOf(direction);
    setDraftShape(next.points);
    setDraftAnchors(next.anchors);
    setSelected(null);
    setDirty(false);
  }

  function insertNear(lat: number, lng: number) {
    const point: LatLng = [lat, lng];
    let nearest = 0;
    let nearestD = Infinity;
    draftShape.forEach((item, index) => {
      const distance = dist2(point, item);
      if (distance < nearestD) {
        nearestD = distance;
        nearest = index;
      }
    });
    if (nearestD < 4e-8) {
      setSelected(nearest);
      return;
    }
    const at = closestSegment(draftShape, lat, lng);
    setDraftShape((points) => [...points.slice(0, at + 1), [lat, lng], ...points.slice(at + 1)]);
    setDraftAnchors((anchors) => anchors.map((anchor) => (anchor > at ? anchor + 1 : anchor)));
    setSelected(at + 1);
    setDirty(true);
  }

  function removeSelected() {
    if (selected == null || anchorSet.has(selected) || draftShape.length < 3) return;
    const index = selected;
    setDraftShape((points) => points.filter((_, item) => item !== index));
    setDraftAnchors((anchors) => anchors.map((anchor) => (anchor > index ? anchor - 1 : anchor)));
    setSelected(null);
    setDirty(true);
  }

  async function saveStop(id: string, lat: number, lng: number) {
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Spremanje nije uspjelo.");
    } finally {
      setBusy(false);
    }
  }

  function moveVertex(index: number, lat: number, lng: number) {
    const point: LatLng = [lat, lng];
    if (anchorSet.has(index)) {
      const stopIndex = draftAnchors.indexOf(index);
      const stopId = direction?.stops[stopIndex]?.stopId;
      setDraftShape((points) => points.map((item, itemIndex) => (itemIndex === index ? point : item)));
      if (stopId) void saveStop(stopId, lat, lng);
      return;
    }
    setDraftShape((points) => points.map((item, itemIndex) => (itemIndex === index ? point : item)));
    setDirty(true);
  }

  async function saveRoad() {
    if (!direction) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/shape", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directionId: direction.id, points: draftShape, anchors: draftAnchors }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cesta nije spremljena.");
      setDraftShape(data.shape);
      setDraftAnchors(data.shapeAnchors);
      setDirty(false);
      toast.success("Cesta je spremljena.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cesta nije spremljena.");
    } finally {
      setBusy(false);
    }
  }

  async function pull(points: LatLng[]) {
    const response = await fetch("/api/admin/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ points }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Cesta nije dohvaćena.");
    return data as { points: LatLng[]; waypointIndexes: number[] };
  }

  async function pullNode() {
    if (selected == null || selected <= 0 || selected >= draftShape.length - 1) {
      toast.error("Odaberi čvor između dva kraja.");
      return;
    }
    setBusy(true);
    try {
      const from = selected - 1;
      const to = selected + 1;
      const routed = await pull(draftShape.slice(from, to + 1));
      const delta = routed.points.length - 3;
      setDraftShape((points) => points.slice(0, from).concat(routed.points, points.slice(to + 1)));
      setDraftAnchors((anchors) =>
        anchors.map((anchor) => {
          if (anchor < from) return anchor;
          if (anchor > to) return anchor + delta;
          return from + (routed.waypointIndexes[anchor - from] ?? 0);
        }),
      );
      setSelected(from + (routed.waypointIndexes[1] ?? 1));
      setDirty(true);
      toast.success("Čvor je povučen na cestu. Spremi ako tako treba ostati.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cesta nije dohvaćena.");
    } finally {
      setBusy(false);
    }
  }

  async function pullDirection() {
    if (!direction) return;
    setBusy(true);
    try {
      const via = draftAnchors.map((anchor) => draftShape[anchor]).filter(Boolean);
      const routed = await pull(via);
      const points = routed.points.map((point) => [point[0], point[1]] as LatLng);
      direction.stops.forEach((call, index) => {
        const named = network?.stops.find((stop) => stop.id === call.stopId);
        const at = routed.waypointIndexes[index];
        if (named && at != null) points[at] = [named.lat, named.lng];
      });
      setDraftShape(points);
      setDraftAnchors(routed.waypointIndexes);
      setSelected(null);
      setDirty(true);
      toast.success("Smjer je povučen na cestu. Spremi ako tako treba ostati.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cesta nije dohvaćena.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col lg:flex-row">
      <aside className="flex max-h-[46%] w-full shrink-0 flex-col border-b bg-background lg:max-h-none lg:w-[380px] lg:border-r lg:border-b-0">
        <div className="border-b px-4 py-3">
          <Link href="/admin" className="text-xs text-muted-foreground">
            Administrator
          </Link>
          <h1 className="font-display text-2xl">Stajališta i ceste</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Povuci stajalište ili bilo koji čvor. Klik na liniju dodaje čvor, a odabrani čvor koji nije stajalište možeš obrisati. Približi kartu da vidiš sve čvorove. Povuci na cestu slaže liniju uz prometnicu.
          </p>
          <label className="mt-3 block text-xs text-muted-foreground">
            Linija
            <select
              className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm text-foreground"
              value={line.id}
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
              {line.directions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground" disabled={busy || !dirty} onClick={saveRoad}>
              Spremi cestu
            </button>
            <button type="button" className="rounded-full bg-muted px-3 py-1.5 text-xs" disabled={busy || selected == null} onClick={pullNode}>
              Povuci čvor na cestu
            </button>
            <button type="button" className="rounded-full bg-muted px-3 py-1.5 text-xs" disabled={busy} onClick={pullDirection}>
              Povuci cijeli smjer na cestu
            </button>
            {dirty && (
              <button type="button" className="rounded-full bg-background px-3 py-1.5 text-xs ring-1 ring-foreground/15" onClick={revert}>
                Odustani
              </button>
            )}
          </div>
          {selected != null && (
            <div className="mt-3 rounded-xl bg-muted p-2 text-sm">
              <p>{selectedIsStop ? `Stajalište: ${selectedStop?.name ?? "čvor"}` : `Čvor ${selected + 1} od ${draftShape.length}`}</p>
              <p className="text-xs text-muted-foreground">Povuci ga po karti. {selectedIsStop ? "Mjesto stajališta se sprema odmah." : "Cestu spremi gumbom iznad."}</p>
              {!selectedIsStop && (
                <button type="button" className="mt-2 rounded-full bg-background px-3 py-1.5 text-xs" disabled={busy} onClick={removeSelected}>
                  Obriši čvor
                </button>
              )}
            </div>
          )}
        </div>
        <ul className="min-h-0 flex-1 overflow-auto px-2 py-2">
          {direction.stops.map((call, index) => {
            const named = network?.stops.find((stop) => stop.id === call.stopId);
            const anchor = draftAnchors[index];
            return (
              <li key={`${call.stopId}-${index}`}>
                <button
                  type="button"
                  className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted ${selected === anchor ? "bg-muted" : ""}`}
                  onClick={() => {
                    setSelected(anchor ?? null);
                    const point = draftShape[anchor];
                    if (point) skip.current = true;
                  }}
                >
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">{call.km}</span>
                  <span className="truncate">{named?.name ?? call.stopId}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      <div className="relative min-h-[320px] flex-1">
        <MapContainer center={[45.4, 15.55]} zoom={10} className="h-full w-full" scrollWheelZoom fadeAnimation={false}>
          <Basemap satellite={satellite} />
          <FitShape points={draftShape} id={direction.id} />
          <Polyline
            positions={draftShape}
            pathOptions={{ color: line.color, weight: 5, opacity: 0.9 }}
            eventHandlers={{
              click: (event) => {
                if (skip.current) {
                  skip.current = false;
                  return;
                }
                insertNear(event.latlng.lat, event.latlng.lng);
              },
            }}
          />
          <Vertices
            points={draftShape}
            anchors={draftAnchors}
            selected={selected}
            busy={busy}
            onSelect={(index) => {
              skip.current = true;
              setSelected(index);
            }}
            onMove={moveVertex}
          />
        </MapContainer>
        <BasemapSwitch satellite={satellite} onChange={setSatellite} />
      </div>
    </div>
  );
}
