import { NextResponse } from "next/server";
import { routeAlongRoads } from "@/lib/road-route";
import { currentUser, inServiceArea } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Samo administrator crta cestu." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { points?: [number, number][] } | null;
  const points = Array.isArray(body?.points) ? body.points : [];
  if (points.length < 2 || points.length > 80) {
    return NextResponse.json({ error: "Odaberi čvorove koje treba povući na cestu." }, { status: 400 });
  }
  if (points.some((point) => !Array.isArray(point) || !inServiceArea(Number(point[0]), Number(point[1])))) {
    return NextResponse.json({ error: "Čvor je izvan područja linija." }, { status: 400 });
  }
  try {
    const routed = await routeAlongRoads(points.map((point) => [Number(point[0]), Number(point[1])]));
    return NextResponse.json(routed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cesta nije dohvaćena.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
