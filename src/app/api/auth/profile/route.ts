import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/fares";
import { currentUser, updateStore } from "@/lib/store";
import type { CategoryId } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = await currentUser();
  if (!session) return NextResponse.json({ error: "Prijavite se." }, { status: 401 });
  const body = (await request.json()) as { name?: string; category?: CategoryId };
  const user = await updateStore((store) => {
    const found = store.users.find((item) => item.id === session.id);
    if (!found) throw new Error("Račun ne postoji.");
    if (body.name && body.name.trim().length >= 2) found.name = body.name.trim();
    if (body.category && CATEGORIES.some((item) => item.id === body.category)) {
      found.category = body.category;
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
