import { NextResponse } from "next/server";
import { currentUser, placeStop, updateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Samo administrator pomiče stajališta." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { id?: string; lat?: number; lng?: number } | null;
  const id = body?.id?.trim() ?? "";
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!id) return NextResponse.json({ error: "Nema stajališta." }, { status: 400 });
  try {
    const stop = await updateStore((store) => placeStop(store, id, lat, lng, "admin"));
    return NextResponse.json({ stop });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stajalište nije spremljeno.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
