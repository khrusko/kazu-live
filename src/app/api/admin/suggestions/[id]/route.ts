import { NextResponse } from "next/server";
import { currentUser, placeStop, updateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Samo administrator pregledava prijedloge." }, { status: 403 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { action?: "prihvati" | "odbij" } | null;
  if (body?.action !== "prihvati" && body?.action !== "odbij") {
    return NextResponse.json({ error: "Odaberi prihvat ili odbijanje." }, { status: 400 });
  }
  try {
    const suggestion = await updateStore((store) => {
      const found = store.suggestions.find((item) => item.id === id);
      if (!found || found.status !== "ceka") throw new Error("Prijedlog više nije na čekanju.");
      if (body.action === "prihvati") {
        placeStop(store, found.stopId, found.lat, found.lng, "admin");
        found.status = "prihvaceno";
      } else {
        found.status = "odbijeno";
      }
      return found;
    });
    return NextResponse.json({ suggestion });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pregled nije spremljen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
