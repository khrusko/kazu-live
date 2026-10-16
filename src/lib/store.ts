import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { hashPassword, readSession, SESSION_COOKIE } from "./auth";
import type { Announcement, Network, PublicUser, Ticket, UserRecord } from "./types";

export type Store = Network & {
  users: UserRecord[];
  tickets: Ticket[];
};

const dataDir = path.join(process.cwd(), "data");
const networkPath = path.join(dataDir, "network.json");
const storePath = path.join(dataDir, "store.json");

const globalStore = globalThis as typeof globalThis & { __kazuQueue?: Promise<unknown> };

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
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(networkPath)) {
    throw new Error("Nema data/network.json. Vozni red još nije uvezen.");
  }
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(seed()));
  }
}

export function readStore(): Store {
  ensure();
  return JSON.parse(fs.readFileSync(storePath, "utf8")) as Store;
}

export function updateStore<T>(fn: (store: Store) => T): Promise<T> {
  const run = queue().then(() => {
    const store = readStore();
    const result = fn(store);
    store.version += 1;
    store.updatedAt = new Date().toISOString();
    const tmp = `${storePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store));
    fs.renameSync(tmp, storePath);
    return result;
  });
  globalStore.__kazuQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function networkView(store: Store): Network {
  return {
    version: store.version,
    updatedAt: store.updatedAt,
    note: store.note,
    source: store.source,
    stops: store.stops,
    lines: store.lines,
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
