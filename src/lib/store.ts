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
  __kazuBackend?: Promise<StoreBackend>;
};

const BLOB_STORE = "kazu-live";
const BLOB_KEY = "store";

type StoreBackend = { kind: "file"; file: string } | { kind: "blobs" };

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

function onNetlify(): boolean {
  return process.env.NETLIFY === "true" || Boolean(process.env.NETLIFY_BLOBS_CONTEXT) || Boolean(process.env.NETLIFY_SITE_ID);
}

/** Local dev writes data/store.json. On Netlify the app directory is read-only, so edits go to site-wide Blobs and survive the next request. */
function storeBackend(): Promise<StoreBackend> {
  if (!globalStore.__kazuBackend) globalStore.__kazuBackend = Promise.resolve(chooseBackend());
  return globalStore.__kazuBackend;
}

function chooseBackend(): StoreBackend {
  if (canWriteDir(dataDir)) return { kind: "file", file: path.join(dataDir, "store.json") };
  if (onNetlify()) return { kind: "blobs" };
  const runtimeDir = os.tmpdir();
  fs.mkdirSync(runtimeDir, { recursive: true });
  return { kind: "file", file: path.join(runtimeDir, "kazu-live-store.json") };
}

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: BLOB_STORE, consistency: "strong" });
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
      name: "Administrator",
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

function requireNetworkFile() {
  if (!fs.existsSync(networkPath)) {
    throw new Error("Nema data/network.json. Vozni red još nije uvezen.");
  }
}

function normalize(store: Store): Store {
  if (!Array.isArray(store.suggestions)) store.suggestions = [];
  if (!Array.isArray(store.users)) store.users = [];
  for (const user of store.users) {
    if (user.role === "admin" && /dispečer/i.test(user.name)) user.name = "Administrator";
  }
  return store;
}

function readFileStore(file: string): Store {
  requireNetworkFile();
  if (!fs.existsSync(file)) {
    const seeded = seed();
    writeFileStore(file, seeded);
    return seeded;
  }
  return normalize(JSON.parse(fs.readFileSync(file, "utf8")) as Store);
}

function writeFileStore(file: string, store: Store) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, file);
}

async function readBlobStore(): Promise<Store> {
  requireNetworkFile();
  const saved = await (await blobStore()).get(BLOB_KEY, { type: "json" });
  if (saved && typeof saved === "object") return normalize(structuredClone(saved) as Store);
  const seeded = seed();
  await (await blobStore()).setJSON(BLOB_KEY, seeded);
  return seeded;
}

async function writeBlobStore(store: Store) {
  try {
    await (await blobStore()).setJSON(BLOB_KEY, store);
  } catch {
    throw new Error("Promjene nisu spremljene na poslužitelj. Pokušaj ponovno.");
  }
}

export async function readStore(): Promise<Store> {
  const backend = await storeBackend();
  if (backend.kind === "file") return readFileStore(backend.file);
  return readBlobStore();
}

/** Timetable baked into the deploy. Used only when the live store cannot be read, and never written back. */
export function readBundledNetwork(): Network {
  requireNetworkFile();
  const raw = JSON.parse(fs.readFileSync(networkPath, "utf8")) as Store;
  return networkView({
    ...raw,
    version: raw.version ?? 1,
    users: [],
    tickets: [],
    suggestions: [],
  });
}

async function writeStore(store: Store) {
  const backend = await storeBackend();
  if (backend.kind === "file") {
    writeFileStore(backend.file, store);
    return;
  }
  await writeBlobStore(store);
}

export function updateStore<T>(fn: (store: Store) => T, bump = true): Promise<T> {
  const run = queue().then(async () => {
    const store = await readStore();
    const result = fn(store);
    if (bump) {
      store.version += 1;
      store.updatedAt = new Date().toISOString();
    }
    await writeStore(store);
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
  const user = (await readStore()).users.find((item) => item.id === userId);
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

/** Move a stop and the road vertex it sits on, on every line that serves it. The editor then redraws the stretch between the neighbouring vertices. */
export function placeStop(store: Store, stopId: string, lat: number, lng: number, precision: string) {
  const stop = store.stops.find((item) => item.id === stopId);
  if (!stop) throw new Error("Stajalište ne postoji.");
  if (!inServiceArea(lat, lng)) throw new Error("Koordinata je izvan područja linija.");
  stop.lat = round6(lat);
  stop.lng = round6(lng);
  stop.precision = precision;
  if (precision === "admin") {
    for (const suggestion of store.suggestions) {
      if (suggestion.stopId === stopId && suggestion.status === "ceka") suggestion.status = "odbijeno";
    }
  }
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

/** Replace one direction's road line. Stop vertices stay on the stops. */
export function replaceShape(store: Store, directionId: string, points: [number, number][], anchors: number[]) {
  for (const line of store.lines) {
    const direction = line.directions.find((item) => item.id === directionId);
    if (!direction) continue;
    if (anchors.length !== direction.stops.length) throw new Error("Cesta nema čvor za svako stajalište.");
    if (points.length < 2 || points.length > 8000) throw new Error("Linija ima previše ili premalo čvorova.");
    let previous = -1;
    for (const anchor of anchors) {
      if (!Number.isInteger(anchor) || anchor < 0 || anchor >= points.length || anchor <= previous) {
        throw new Error("Čvorovi stajališta nisu poredani uz liniju.");
      }
      previous = anchor;
    }
    const shape = points.map((point) => {
      if (!inServiceArea(point[0], point[1])) throw new Error("Čvor je izvan područja linija.");
      return [round6(point[0]), round6(point[1])] as [number, number];
    });
    direction.stops.forEach((call, index) => {
      const stop = store.stops.find((item) => item.id === call.stopId);
      if (!stop) throw new Error("Stajalište na liniji ne postoji.");
      direction.geometry[index] = [stop.lat, stop.lng];
      shape[anchors[index]] = [stop.lat, stop.lng];
    });
    direction.shape = shape;
    direction.shapeAnchors = anchors.slice();
    return direction;
  }
  throw new Error("Smjer ne postoji.");
}
