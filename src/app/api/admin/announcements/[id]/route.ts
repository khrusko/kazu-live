import { NextResponse } from "next/server";
import { currentUser, updateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Samo dispečer može brisati obavijest." }, { status: 403 });
  }
  const { id } = await context.params;
  await updateStore((store) => {
    store.announcements = store.announcements.filter((item) => item.id !== id);
  });
  return NextResponse.json({ ok: true });
}
