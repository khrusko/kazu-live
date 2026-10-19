import { NextResponse } from "next/server";
import { currentUser, readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Samo administrator vidi prijedloge." }, { status: 403 });
  }
  const store = readStore();
  const suggestions = store.suggestions
    .filter((item) => item.status === "ceka")
    .map((item) => ({
      ...item,
      stopName: store.stops.find((stop) => stop.id === item.stopId)?.name ?? item.stopId,
      currentLat: store.stops.find((stop) => stop.id === item.stopId)?.lat ?? null,
      currentLng: store.stops.find((stop) => stop.id === item.stopId)?.lng ?? null,
    }));
  return NextResponse.json({ suggestions });
}
