import { NextResponse } from "next/server";
import { currentUser, updateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export async function POST(request: Request) {
  const session = await currentUser();
  if (!session) return NextResponse.json({ error: "Prijavite se da omiljena linija ostane spremljena na računu." }, { status: 401 });
  const body = (await request.json()) as { lineId?: string; stopId?: string };
  const user = await updateStore((store) => {
    const found = store.users.find((item) => item.id === session.id);
    if (!found) throw new Error("Račun ne postoji.");
    if (body.lineId) {
      if (!store.lines.some((line) => line.id === body.lineId)) throw new Error("Linija ne postoji.");
      found.favoriteLineIds = toggle(found.favoriteLineIds, body.lineId);
    }
    if (body.stopId) {
      if (!store.stops.some((stop) => stop.id === body.stopId)) throw new Error("Stajalište ne postoji.");
      found.favoriteStopIds = toggle(found.favoriteStopIds, body.stopId);
    }
    return {
      id: found.id,
      email: found.email,
      name: found.name,
      role: found.role,
      category: found.category,
      favoriteLineIds: found.favoriteLineIds,
      favoriteStopIds: found.favoriteStopIds,
    };
  }, false);
  return NextResponse.json({ user });
}
