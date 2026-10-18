import fs from "fs";
import os from "os";
import path from "path";
import { cookies } from "next/headers";
import rawRoads from "../../data/roads.json";
import { hashPassword, readSession, SESSION_COOKIE } from "./auth";
import type { Announcement, Direction, Network, PublicUser, StopSuggestion, Ticket, UserRecord } from "./types";

export type Store = Network & {
  users: UserRecord[];
  tickets: Ticket[];
  suggestions: StopSuggestion[];
};

const dataDir = path.join(process.cwd(), "data");
const networkPath = path.join(dataDir, "network.json");
const roadsPath = path.join(dataDir, "roads.json");

type RoadShape = { points: [number, number][]; anchors: number[] };
const bundledRoads = rawRoads as unknown as Record<string, RoadShape>;
let roadsCache: { mtime: number; roads: Record<string, RoadShape> } | null = null;

function readRoads(): Record<string, RoadShape> {
  try {
    if (fs.existsSync(roadsPath)) {
      const mtime = fs.statSync(roadsPath).mtimeMs;
      if (roadsCache && roadsCache.mtime === mtime) return roadsCache.roads;
      const roads = JSON.parse(fs.readFileSync(roadsPath, "utf8")) as Record<string, RoadShape>;
      roadsCache = { mtime, roads };
      return roads;
    }
  } catch {
    // The deployed function image can omit data/roads.json. The imported copy still has the shapes.
  }
  return bundledRoads;
}

const globalStore = globalThis as typeof globalThis & {
  __kazuQueue?: Promise<unknown>;
  __kazuStorePath?: string;
};

function canWriteDir(dir: string): boolean {
  const probe = path.join(dir, `.kazu-write-probe-${process.pid}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(probe, "1");
    return true;
  } catch {
    return false;
  } finally {
    try {
      fs.unlinkSync(probe);
    } catch {
      // Probe was never created, or the directory is read-only.
    }
  }
}

/** Local dev writes data/store.json. Netlify's /var/task is read-only, so fall back to the instance temp dir. */
function storeFilePath(): string {
  if (globalStore.__kazuStorePath) return globalStore.__kazuStorePath;
  if (canWriteDir(dataDir)) {
    globalStore.__kazuStorePath = path.join(dataDir, "store.json");
    return globalStore.__kazuStorePath;
  }
  const runtimeDir = os.tmpdir();
  fs.mkdirSync(runtimeDir, { recursive: true });
  globalStore.__kazuStorePath = path.join(runtimeDir, "kazu-live-store.json");
  return globalStore.__kazuStorePath;
}

function queue(): Promise<unknown> {
  if (!globalStore.__kazuQueue) globalStore.__kazuQueue = Promise.resolve();
  return globalStore.__kazuQueue;
}

function toPublic(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    category: user.category,
    favoriteLineIds: user.favoriteLineIds,
    favoriteStopIds: user.favoriteStopIds,
  };
}

function seed(): Store {
  const raw = JSON.parse(fs.readFileSync(networkPath, "utf8")) as Omit<Store, "version" | "users" | "tickets"> & {
    version?: number;
  };
  const users: UserRecord[] = [
    {
      id: "u_admin",
      email: "admin@kazide.hr",
      name: "Dispečer županije",
      role: "admin",
      category: "puni",
      favoriteLineIds: [],
      favoriteStopIds: [],
      passwordHash: hashPassword("KazuAdmin2026"),
    },
    {
      id: "u_ana",
      email: "ana@kazide.hr",
      name: "Ana Kovač",
      role: "user",
      category: "student",
      favoriteLineIds: ["A1", "A3"],
      favoriteStopIds: [],
      passwordHash: hashPassword("Putnik2026"),
    },
  ];
  return {
    version: 1,
    updatedAt: raw.updatedAt,
    note: raw.note,
    source: raw.source,
    stops: raw.stops,
    lines: raw.lines,
    announcements: raw.announcements,
    users,
    tickets: [],
    suggestions: [],
  };
}

function ensure() {
  if (!fs.existsSync(networkPath)) {
    throw new Error("Nema data/network.json. Vozni red još nije uvezen.");
  }
  const file = storeFilePath();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(seed()));
  }
}

export function readStore(): Store {
  ensure();
  const store = JSON.parse(fs.readFileSync(storeFilePath(), "utf8")) as Store;
  if (!Array.isArray(store.suggestions)) store.suggestions = [];
  return store;
}

export function updateStore<T>(fn: (store: Store) => T, bump = true): Promise<T> {
  const run = queue().then(() => {
    const store = readStore();
    const result = fn(store);
    if (bump) {
      store.version += 1;
      store.updatedAt = new Date().toISOString();
    }
    const file = storeFilePath();
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store));
    fs.renameSync(tmp, file);
    return result;
  });
  globalStore.__kazuQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

let colorCache: { mtime: number; colors: Map<string, string> } | null = null;

function lineColors(): Map<string, string> {
  const mtime = fs.statSync(networkPath).mtimeMs;
  if (colorCache && colorCache.mtime === mtime) return colorCache.colors;
  const raw = JSON.parse(fs.readFileSync(networkPath, "utf8")) as { lines?: { id: string; color?: string }[] };
  const colors = new Map((raw.lines ?? []).filter((line) => line.color).map((line) => [line.id, line.color as string]));
  colorCache = { mtime, colors };
  return colors;
}

export function networkView(store: Store): Network {
  const roads = readRoads();
  const colors = lineColors();
  return {
    version: store.version,
    updatedAt: store.updatedAt,
    note: store.note,
    source: store.source,
    stops: store.stops,
    lines: store.lines.map((line) => ({
      ...line,
      color: colors.get(line.id) ?? line.color,
      directions: line.directions.map((direction) => {
        if (direction.shape?.length && direction.shapeAnchors?.length === direction.stops.length) return direction;
        const road = roads[direction.id];
        if (!road?.points?.length || road.anchors?.length !== direction.stops.length) return direction;
        return { ...direction, shape: road.points, shapeAnchors: road.anchors };
      }),
    })),
    announcements: store.announcements,
  };
}

export async function currentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const userId = readSession(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const user = readStore().users.find((item) => item.id === userId);
  return user ? toPublic(user) : null;
}

export function addAnnouncement(store: Store, announcement: Announcement) {
  store.announcements.unshift(announcement);
}

function round6(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

export function inServiceArea(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 44.7 && lat <= 46.2 && lng >= 14.8 && lng <= 16.4;
}

function ensureShape(direction: Direction, roads: Record<string, RoadShape>, stops: Store["stops"]) {
  if (!Array.isArray(direction.geometry) || direction.geometry.length !== direction.stops.length) {
    direction.geometry = direction.stops.map((call) => {
      const stop = stops.find((item) => item.id === call.stopId);
      return [stop?.lat ?? 0, stop?.lng ?? 0];
    });
  }
  if (direction.shape?.length && direction.shapeAnchors?.length === direction.stops.length) return;
  const road = roads[direction.id];
  if (road?.points?.length && road.anchors?.length === direction.stops.length) {
    direction.shape = road.points.map((point) => [point[0], point[1]]);
    direction.shapeAnchors = road.anchors.slice();
    return;
  }
  direction.shape = direction.geometry.map((point) => [point[0], point[1]]);
  direction.shapeAnchors = direction.geometry.map((_, index) => index);
}

/** Move a stop and the road vertex it sits on, on every line that serves it. */
export function placeStop(store: Store, stopId: string, lat: number, lng: number, precision: string) {
  const stop = store.stops.find((item) => item.id === stopId);
  if (!stop) throw new Error("Stajalište ne postoji.");
  if (!inServiceArea(lat, lng)) throw new Error("Koordinata je izvan područja linija.");
  stop.lat = round6(lat);
  stop.lng = round6(lng);
  stop.precision = precision;
  const roads = readRoads();
  for (const line of store.lines) {
    for (const direction of line.directions) {
      if (!direction.stops.some((call) => call.stopId === stopId)) continue;
      ensureShape(direction, roads, store.stops);
      direction.stops.forEach((call, index) => {
        if (call.stopId !== stopId) return;
        direction.geometry[index] = [stop.lat, stop.lng];
        const anchor = direction.shapeAnchors?.[index];
        if (direction.shape && anchor != null) direction.shape[anchor] = [stop.lat, stop.lng];
      });
    }
  }
  return stop;
}

/** Replace the driving line between two neighbouring stops. Endpoints stay on the stops. */
export function replaceSegment(store: Store, directionId: string, fromIndex: number, points: [number, number][]) {
  const roads = readRoads();
  for (const line of store.lines) {
    const direction = line.directions.find((item) => item.id === directionId);
    if (!direction) continue;
    if (fromIndex < 0 || fromIndex >= direction.stops.length - 1) throw new Error("Dionica nije između dva stajališta.");
    ensureShape(direction, roads, store.stops);
    const fromStop = store.stops.find((item) => item.id === direction.stops[fromIndex].stopId);
    const toStop = store.stops.find((item) => item.id === direction.stops[fromIndex + 1].stopId);
    if (!fromStop || !toStop) throw new Error("Stajalište na dionici ne postoji.");
    const start: [number, number] = [fromStop.lat, fromStop.lng];
    const end: [number, number] = [toStop.lat, toStop.lng];
    const middle = points.filter((point) => inServiceArea(point[0], point[1]));
    const path: [number, number][] = [start, ...middle.map((point) => [round6(point[0]), round6(point[1])] as [number, number]), end];
    if (path.length > 80) throw new Error("Previše točaka na dionici.");
    const shape = direction.shape!;
    const anchors = direction.shapeAnchors!;
    const at = anchors[fromIndex];
    const to = anchors[fromIndex + 1];
    if (to < at) throw new Error("Cesta je oštećena.");
    const next = shape.slice(0, at).concat(path, shape.slice(to + 1));
    const delta = path.length - (to - at + 1);
    const nextAnchors = anchors.map((anchor, index) => (index > fromIndex ? anchor + delta : anchor));
    nextAnchors[fromIndex + 1] = at + path.length - 1;
    direction.shape = next;
    direction.shapeAnchors = nextAnchors;
    direction.geometry[fromIndex] = start;
    direction.geometry[fromIndex + 1] = end;
    return direction;
  }
  throw new Error("Smjer ne postoji.");
}
