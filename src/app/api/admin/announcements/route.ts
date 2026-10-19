import { NextResponse } from "next/server";
import { currentUser, updateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Samo administrator može objaviti obavijest." }, { status: 403 });
  }
  const body = (await request.json()) as {
    title?: string;
    body?: string;
    lineIds?: string[];
    severity?: "info" | "warning" | "change";
  };
  const title = body.title?.trim() ?? "";
  const text = body.body?.trim() ?? "";
  if (title.length < 3 || text.length < 3) {
    return NextResponse.json({ error: "Naslov i tekst su obavezni." }, { status: 400 });
  }
  const announcement = await updateStore((store) => {
    const lineIds = (body.lineIds ?? []).filter((id) => store.lines.some((line) => line.id === id));
    const created = {
      id: `ann_${crypto.randomUUID().slice(0, 8)}`,
      title,
      body: text,
      lineIds,
      severity: body.severity ?? "info",
      publishedAt: new Date().toISOString(),
    };
    store.announcements.unshift(created);
    return created;
  });
  return NextResponse.json({ announcement });
}
