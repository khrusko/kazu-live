import { NextResponse } from "next/server";
import { currentUser, replaceSegment, updateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Samo administrator crta cestu." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    directionId?: string;
    fromIndex?: number;
    points?: [number, number][];
  } | null;
  const directionId = body?.directionId?.trim() ?? "";
  const fromIndex = Number(body?.fromIndex);
  const points = Array.isArray(body?.points) ? body.points : [];
  if (!directionId || !Number.isInteger(fromIndex)) {
    return NextResponse.json({ error: "Odaberi dionicu između dva stajališta." }, { status: 400 });
  }
  if (points.length < 1 || points.length > 60) {
    return NextResponse.json({ error: "Klikni po karti kuda autobus stvarno ide." }, { status: 400 });
  }
  try {
    const direction = await updateStore((store) => replaceSegment(store, directionId, fromIndex, points));
    return NextResponse.json({
      directionId: direction.id,
      shape: direction.shape,
      shapeAnchors: direction.shapeAnchors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cesta nije spremljena.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
