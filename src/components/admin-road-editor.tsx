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

function nodeIcon(kind: "stop" | "node" | "selected", zoom: number) {
  const zoomedOut = zoom < 13;
  const size = kind === "node" ? (zoomedOut ? 16 : 14) : kind === "selected" ? (zoomedOut ? 36 : 30) : zoomedOut ? 32 : 26;
  const color = kind === "selected" ? "#b45309" : kind === "stop" ? "#0f766e" : "#1c1915";
  return L.divIcon({
    className: "edit-pin",
    html: `<div style="width:${size}px;height:${size}px;border-radius:99px;background:${color};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5);cursor:pointer"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function neighborSpan(points: LatLng[], anchor: number) {
  if (anchor <= 0) return { from: 0, to: Math.min(1, Math.max(points.length - 1, 0)) };
  if (anchor >= points.length - 1) return { from: Math.max(0, points.length - 2), to: points.length - 1 };
  return { from: anchor - 1, to: anchor + 1 };
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

function ShowSavedSpan({ points, span }: { points: LatLng[]; span: { from: number; to: number } | null }) {
  const map = useMap();
  const key = span ? `${span.from}:${span.to}:${points.length}` : "";
  useEffect(() => {
    if (!span || span.to <= span.from) return;
    const slice = points.slice(span.from, span.to + 1);
    if (slice.length >= 2) map.fitBounds(slice, { padding: [36, 36], maxZoom: 15 });
    // Show the saved stretch once, not on later pans.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
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
  onDelete,
}: {
  points: LatLng[];
  anchors: number[];
  selected: number | null;
  busy: boolean;
  onSelect: (index: number) => void;
  onMove: (index: number, lat: number, lng: number) => void;
  onDelete: (index: number) => void;
}) {
  const map = useMap();
  const lastClick = useRef<{ index: number; at: number } | null>(null);
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
      if (zoom < 11 || !bounds) return false;
      return bounds.contains([point[0], point[1]]);
    })
    .slice(0, 400);

  return (
    <>
      {visible.map(({ point, index }) => {
        const kind = index === selected ? "selected" : anchorSet.has(index) ? "stop" : "node";
        const size = kind === "node" ? (zoom < 13 ? 16 : 14) : kind === "selected" ? (zoom < 13 ? 36 : 30) : zoom < 13 ? 32 : 26;
        return (
          <Marker
            key={index}
            position={point}
            icon={nodeIcon(kind, zoom)}
            draggable={!busy}
            zIndexOffset={kind === "node" ? 300 : 700}
            eventHandlers={{
              click: (event) => {
                L.DomEvent.stopPropagation(event.originalEvent);
                const now = Date.now();
                const detail = event.originalEvent?.detail ?? 1;
                const repeat = detail >= 2 || (lastClick.current?.index === index && now - lastClick.current.at < 450);
                if (repeat) {
                  lastClick.current = null;
                  onDelete(index);
                  return;
                }
                lastClick.current = { index, at: now };
                onSelect(index);
              },
              dblclick: (event) => {
                L.DomEvent.stop(event.originalEvent);
                onDelete(index);
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
  const [savedSpan, setSavedSpan] = useState<{ from: number; to: number } | null>(null);
  const skip = useRef(false);
  const saving = useRef(false);
  const dirtyRef = useRef(false);
  const loadedId = useRef("");
  const selectedRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const directionByLine = useRef<Record<string, string>>({});
  const kept = useRef(new Map<string, { points: LatLng[]; anchors: number[]; version: number }>());
  const removeRef = useRef<(index: number) => void>(() => undefined);
  selectedRef.current = selected;
  busyRef.current = busy;

  const line = network?.lines.find((item) => item.id === lineId) ?? network?.lines[0] ?? null;
  const direction = line?.directions.find((item) => item.id === directionId) ?? line?.directions[0] ?? null;
  const activeDirectionId = direction?.id ?? "";

  function markDirty(value: boolean) {
    dirtyRef.current = value;
    setDirty(value);
  }

  useEffect(() => {
    if (!direction) return;
    const version = network?.version ?? 0;
    const remembered = kept.current.get(direction.id);
    const fromNetwork = shapeOf(direction);
    const source = remembered && remembered.version > version ? remembered : { points: fromNetwork.points, anchors: fromNetwork.anchors };
    const sameDirection = loadedId.current === direction.id;
    if (sameDirection && dirtyRef.current) return;
    loadedId.current = direction.id;
    dirtyRef.current = false;
    setDraftShape(source.points.map((point) => [point[0], point[1]] as LatLng));
    setDraftAnchors(source.anchors.slice());
    setDirty(false);
    if (!sameDirection) {
      setSelected(null);
      setSavedSpan(null);
    }
    // A newer saved shape wins over a stale network response. Unsaved vertices stay until the direction changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDirectionId, network?.version]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || (event.key !== "Backspace" && event.key !== "Delete")) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      if (selectedRef.current == null || busyRef.current) return;
      event.preventDefault();
      removeRef.current(selectedRef.current);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  const selectedStopIndex = selectedIsStop && selected != null ? draftAnchors.indexOf(selected) : -1;
  const selectedStop =
    selectedStopIndex >= 0 ? network?.stops.find((stop) => stop.id === direction.stops[selectedStopIndex]?.stopId) : null;
  const stopTitle = (stopId: string | undefined) => network?.stops.find((stop) => stop.id === stopId)?.name ?? stopId ?? "";
  const routeLabel =
    selectedStopIndex >= 0
      ? [
          selectedStopIndex > 0 ? stopTitle(direction.stops[selectedStopIndex - 1]?.stopId) : null,
          selectedStop?.name ?? stopTitle(direction.stops[selectedStopIndex]?.stopId),
          selectedStopIndex < direction.stops.length - 1 ? stopTitle(direction.stops[selectedStopIndex + 1]?.stopId) : null,
        ]
          .filter((name): name is string => Boolean(name))
          .join(" → ")
      : "";
  const span =
    savedSpan && savedSpan.to > savedSpan.from && savedSpan.from >= 0 && savedSpan.to < draftShape.length
      ? savedSpan
      : selectedIsStop && selected != null
        ? neighborSpan(draftShape, selected)
        : null;

  function chooseLine(id: string) {
    if (line && direction) directionByLine.current[line.id] = direction.id;
    setLineId(id);
    setDirectionId(directionByLine.current[id] ?? "");
  }

  function chooseDirection(id: string) {
    setDirectionId(id);
    if (line) directionByLine.current[line.id] = id;
  }

  function revert() {
    if (!direction) return;
    const next = shapeOf(direction);
    setDraftShape(next.points);
    setDraftAnchors(next.anchors);
    setSelected(null);
    markDirty(false);
    setSavedSpan(null);
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
      setSavedSpan(null);
      return;
    }
    const at = closestSegment(draftShape, lat, lng);
    setDraftShape((points) => [...points.slice(0, at + 1), [lat, lng], ...points.slice(at + 1)]);
    setDraftAnchors((anchors) => anchors.map((anchor) => (anchor > at ? anchor + 1 : anchor)));
    setSelected(at + 1);
    markDirty(true);
    setSavedSpan(null);
  }

  function removeVertex(index: number) {
    if (anchorSet.has(index)) {
      toast.error("Stajalište se ne briše. Dvostruki klik i Delete brišu samo čvor ceste.");
      return;
    }
    if (draftShape.length < 3) {
      toast.error("Linija mora zadržati barem dva čvora.");
      return;
    }
    setDraftShape((points) => points.filter((_, item) => item !== index));
    setDraftAnchors((anchors) => anchors.map((anchor) => (anchor > index ? anchor - 1 : anchor)));
    setSelected(null);
    markDirty(true);
    setSavedSpan(null);
  }
  removeRef.current = removeVertex;

  async function saveMovedStop(stopId: string, lat: number, lng: number, points: LatLng[], anchors: number[], vertexIndex: number, previous: LatLng[]) {
    if (!direction || saving.current) return;
    const stopIndex = anchors.indexOf(vertexIndex);
    if (stopIndex < 0) return;
    const nameOf = (id: string | undefined) => network?.stops.find((stop) => stop.id === id)?.name ?? null;
    const label = [stopIndex > 0 ? nameOf(direction.stops[stopIndex - 1]?.stopId) : null, nameOf(stopId) ?? "Stajalište", stopIndex < direction.stops.length - 1 ? nameOf(direction.stops[stopIndex + 1]?.stopId) : null]
      .filter((name): name is string => Boolean(name))
      .join(" → ");
    saving.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/stop-road", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: stopId,
          lat,
          lng,
          draft: { directionId: direction.id, points, anchors, stopIndex },
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        version?: number;
        directions?: { id: string; shape: LatLng[]; shapeAnchors: number[]; routed: boolean; focus: { from: number; to: number } | null }[];
      };
      if (!response.ok) throw new Error(data.error || "Spremanje nije uspjelo.");
      const saved = data.directions?.find((item) => item.id === direction.id);
      if (!saved?.shape || !saved.shapeAnchors) throw new Error("Cesta nije spremljena.");
      const savedPoints = saved.shape.map((point) => [point[0], point[1]] as LatLng);
      const savedAnchors = saved.shapeAnchors.slice();
      const version = Number(data.version) || (network?.version ?? 0) + 1;
      for (const item of data.directions ?? []) {
        if (!item.shape || !item.shapeAnchors) continue;
        kept.current.set(item.id, {
          points: item.shape.map((point) => [point[0], point[1]] as LatLng),
          anchors: item.shapeAnchors.slice(),
          version,
        });
      }
      setDraftShape(savedPoints);
      setDraftAnchors(savedAnchors);
      setSelected(savedAnchors[stopIndex] ?? null);
      setSavedSpan(saved.focus);
      markDirty(false);
      toast.success(saved.routed ? `Spremljeno. Nova ruta: ${label}.` : "Stajalište je spremljeno. Cesta nije dohvaćena, čvor je i dalje spojen sa susjedima.");
      await refresh({ minVersion: version }).catch(() => undefined);
    } catch (error) {
      setDraftShape(previous.map((point) => [point[0], point[1]]));
      toast.error(error instanceof Error ? error.message : "Spremanje nije uspjelo.");
    }
    saving.current = false;
    setBusy(false);
  }

  function moveVertex(index: number, lat: number, lng: number) {
    const point: LatLng = [lat, lng];
    if (anchorSet.has(index)) {
      if (saving.current) return;
      const next = draftShape.map((item, itemIndex) => (itemIndex === index ? point : item));
      const stopIndex = draftAnchors.indexOf(index);
      const stopId = direction?.stops[stopIndex]?.stopId;
      setDraftShape(next);
      if (stopId) void saveMovedStop(stopId, lat, lng, next, draftAnchors, index, draftShape);
      return;
    }
    setDraftShape((points) => points.map((item, itemIndex) => (itemIndex === index ? point : item)));
    setSavedSpan(null);
    markDirty(true);
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
      const points = (data.shape as LatLng[]).map((point) => [point[0], point[1]] as LatLng);
      const anchors = (data.shapeAnchors as number[]).slice();
      const version = Number(data.version) || (network?.version ?? 0) + 1;
      kept.current.set(direction.id, { points, anchors, version });
      setDraftShape(points);
      setDraftAnchors(anchors);
      markDirty(false);
      setSavedSpan(null);
      toast.success("Cesta je spremljena.");
      await refresh({ minVersion: version }).catch(() => undefined);
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
      markDirty(true);
      setSavedSpan(null);
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
      markDirty(true);
      setSavedSpan(null);
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
            Zelena točka je stajalište i spaja prethodni čvor sa sljedećim. Povuci je: cesta između tih čvorova odmah ide preko novog mjesta i sprema se. Crni čvor složi ručno i spremi ga gumbom Spremi cestu. Klik na liniju dodaje čvor. Dvostruki klik na crni čvor briše ga, isto kao tipka Delete ili Backspace.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0f766e]" />
              Stajalište, spoj prethodnog i sljedećeg čvora
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1c1915]" />
              Čvor ceste, sprema se gumbom
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-6 rounded-full bg-[#b45309]" />
              Ruta između susjednih čvorova
            </li>
          </ul>
          <label className="mt-3 block text-xs text-muted-foreground">
            Linija
            <select
              className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm text-foreground"
              value={line.id}
              disabled={busy}
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
              disabled={busy}
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
            <button type="button" className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40" disabled={busy || !dirty} onClick={saveRoad}>
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
              {selectedIsStop && routeLabel && <p className="mt-1 text-xs">Spoj: {routeLabel}</p>}
              <p className="text-xs text-muted-foreground">
                {selectedIsStop
                  ? savedSpan
                    ? "Nova ruta je narančasta i već je spremljena."
                    : "Povuci stajalište. Nova ruta između susjednih čvorova postane narančasta i odmah se spremi."
                  : "Povuci ga po karti. Cestu spremi gumbom iznad."}
              </p>
              {!selectedIsStop && (
                <button type="button" className="mt-2 rounded-full bg-background px-3 py-1.5 text-xs" disabled={busy} onClick={() => removeVertex(selected)}>
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
                    if (anchor !== selected) setSavedSpan(null);
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
        <MapContainer center={[45.4, 15.55]} zoom={10} className="h-full w-full" scrollWheelZoom doubleClickZoom={false} fadeAnimation={false}>
          <Basemap satellite={satellite} />
          <FitShape points={draftShape} id={direction.id} />
          <ShowSavedSpan points={draftShape} span={savedSpan} />
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
          {span && span.to > span.from && (
            <Polyline positions={draftShape.slice(span.from, span.to + 1)} pathOptions={{ color: "#b45309", weight: 8, opacity: 0.95, interactive: false }} />
          )}
          <Vertices
            points={draftShape}
            anchors={draftAnchors}
            selected={selected}
            busy={busy}
            onSelect={(index) => {
              skip.current = true;
              if (index !== selected) setSavedSpan(null);
              setSelected(index);
            }}
            onMove={moveVertex}
            onDelete={removeVertex}
          />
        </MapContainer>
        <BasemapSwitch satellite={satellite} onChange={setSatellite} />
      </div>
    </div>
  );
}
