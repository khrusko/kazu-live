import { NextResponse } from "next/server";
import { currentUser, inServiceArea, placeStop, readStore, updateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { stopId?: string; lat?: number; lng?: number; note?: string } | null;
  const stopId = body?.stopId?.trim() ?? "";
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const note = (body?.note ?? "").trim().slice(0, 240);
  if (!stopId || !inServiceArea(lat, lng)) {
    return NextResponse.json({ error: "Odaberi stajalište i točku na karti." }, { status: 400 });
  }
  const user = await currentUser();
  try {
    const suggestion = await updateStore((store) => {
      const stop = store.stops.find((item) => item.id === stopId);
      if (!stop) throw new Error("Stajalište ne postoji.");
      if (user?.role !== "admin") {
        const waiting = store.suggestions.filter((item) => item.stopId === stopId && item.status === "ceka");
        if (waiting.length >= 5) throw new Error("Za ovo stajalište već ima nekoliko prijedloga na čekanju.");
        if (store.suggestions.filter((item) => item.status === "ceka").length >= 300) {
          throw new Error("Previše prijedloga čeka pregled. Pokušaj kasnije.");
        }
      }
      const created = {
        id: `sug_${crypto.randomUUID().slice(0, 8)}`,
        stopId,
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        note,
        status: user?.role === "admin" ? ("prihvaceno" as const) : ("ceka" as const),
        createdAt: new Date().toISOString(),
        byName: user?.name ?? null,
      };
      if (user?.role === "admin") placeStop(store, stopId, created.lat, created.lng, "admin");
      store.suggestions.unshift(created);
      return created;
    });
    return NextResponse.json({ suggestion, applied: suggestion.status === "prihvaceno" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prijedlog nije spremljen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  const suggestions = (await readStore()).suggestions.filter((item) => item.status === "ceka");
  return NextResponse.json({ count: suggestions.length });
}
