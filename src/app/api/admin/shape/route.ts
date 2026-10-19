import { NextResponse } from "next/server";
import { currentUser, replaceShape, updateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Samo administrator crta cestu." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    directionId?: string;
    points?: [number, number][];
    anchors?: number[];
  } | null;
  const directionId = body?.directionId?.trim() ?? "";
  const points = Array.isArray(body?.points) ? body.points : [];
  const anchors = Array.isArray(body?.anchors) ? body.anchors.map((anchor) => Number(anchor)) : [];
  if (!directionId) return NextResponse.json({ error: "Odaberi smjer." }, { status: 400 });
  try {
    const direction = await updateStore((store) => replaceShape(store, directionId, points, anchors));
    return NextResponse.json({ directionId: direction.id, shape: direction.shape, shapeAnchors: direction.shapeAnchors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cesta nije spremljena.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
