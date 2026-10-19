import { NextResponse } from "next/server";
import { reconnectDirections, type DirectionDraft } from "@/lib/reconnect-stop";
import { routeAlongRoads } from "@/lib/road-route";
import { currentUser, inServiceArea, networkView, placeStop, readStore, replaceShape, updateStore } from "@/lib/store";
import type { Direction } from "@/lib/types";

export const dynamic = "force-dynamic";

type LatLng = [number, number];

function asPoints(value: unknown): LatLng[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 8000) return null;
  const points: LatLng[] = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) return null;
    const lat = Number(item[0]);
    const lng = Number(item[1]);
    if (!inServiceArea(lat, lng)) return null;
    points.push([lat, lng]);
  }
  return points;
}

function asAnchors(value: unknown, points: number, stops: number): number[] | null {
  if (!Array.isArray(value) || value.length !== stops) return null;
  const anchors = value.map((anchor) => Number(anchor));
  let previous = -1;
  for (const anchor of anchors) {
    if (!Number.isInteger(anchor) || anchor <= previous || anchor >= points) return null;
    previous = anchor;
  }
  return anchors;
}

function round6(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

function shapeOf(direction: Direction): DirectionDraft {
  const points = (direction.shape?.length ? direction.shape : direction.geometry).map((point) => [point[0], point[1]] as LatLng);
  const anchors =
    direction.shapeAnchors?.length === direction.stops.length ? direction.shapeAnchors.slice() : points.map((_, index) => index);
  return { id: direction.id, stops: direction.stops, points, anchors };
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Samo administrator pomiče stajališta." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    lat?: number;
    lng?: number;
    draft?: { directionId?: string; points?: unknown; anchors?: unknown; stopIndex?: number };
  } | null;
  const id = body?.id?.trim() ?? "";
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!id) return NextResponse.json({ error: "Nema stajališta." }, { status: 400 });
  if (!inServiceArea(lat, lng)) return NextResponse.json({ error: "Koordinata je izvan područja linija." }, { status: 400 });

  const view = networkView(readStore());
  const affected = view.lines.flatMap((line) => line.directions).filter((direction) => direction.stops.some((call) => call.stopId === id));
  if (!view.stops.some((stop) => stop.id === id)) {
    return NextResponse.json({ error: "Stajalište ne postoji." }, { status: 400 });
  }

  const drafts = affected.map(shapeOf);
  const draftBody = body?.draft;
  if (draftBody?.directionId) {
    const draft = drafts.find((item) => item.id === draftBody.directionId);
    if (!draft) return NextResponse.json({ error: "Smjer nema to stajalište." }, { status: 400 });
    const points = asPoints(draftBody.points);
    const anchors = points ? asAnchors(draftBody.anchors, points.length, draft.stops.length) : null;
    const stopIndex = Number(draftBody.stopIndex);
    if (!points || !anchors || !Number.isInteger(stopIndex) || stopIndex < 0 || stopIndex >= draft.stops.length) {
      return NextResponse.json({ error: "Cesta u nacrtu nije ispravna." }, { status: 400 });
    }
    if (draft.stops[stopIndex]?.stopId !== id) {
      return NextResponse.json({ error: "Odabrani čvor nije to stajalište." }, { status: 400 });
    }
    draft.points = points;
    draft.anchors = anchors;
    draft.focusStopIndex = stopIndex;
  }

  try {
    const planned = await reconnectDirections(drafts, id, [lat, lng], routeAlongRoads, (point) => inServiceArea(point[0], point[1]));
    const saved = await updateStore((store) => {
      const stop = placeStop(store, id, lat, lng, "admin");
      const directions = planned.map((item) => {
        const direction = replaceShape(store, item.id, item.points, item.anchors);
        // Keep every other stop vertex where the draft left it. Only the moved stop is pinned to its new coordinate.
        direction.stops.forEach((call, index) => {
          if (call.stopId === id) return;
          const anchor = direction.shapeAnchors?.[index];
          const planned = item.points[item.anchors[index]];
          if (!direction.shape || anchor == null || !planned) return;
          direction.shape[anchor] = [round6(planned[0]), round6(planned[1])];
        });
        return {
          id: direction.id,
          shape: direction.shape,
          shapeAnchors: direction.shapeAnchors,
          routed: item.routed,
          focus: item.focus,
        };
      });
      return { stop, directions };
    });
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stajalište nije spremljeno.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
