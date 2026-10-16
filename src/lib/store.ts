import fs from "fs";
import os from "os";
import path from "path";
import { cookies } from "next/headers";
import rawRoads from "../../data/roads.json";
import { hashPassword, readSession, SESSION_COOKIE } from "./auth";
import type { Announcement, Network, PublicUser, Ticket, UserRecord } from "./types";

export type Store = Network & {
  users: UserRecord[];
  tickets: Ticket[];
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
  return JSON.parse(fs.readFileSync(storeFilePath(), "utf8")) as Store;
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
