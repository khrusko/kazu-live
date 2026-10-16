import { NextResponse } from "next/server";
import { hashPassword, signSession, SESSION_COOKIE } from "@/lib/auth";
import { updateStore } from "@/lib/store";
import type { CategoryId } from "@/lib/types";
import { CATEGORIES } from "@/lib/fares";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
    category?: CategoryId;
  };
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const category = CATEGORIES.some((item) => item.id === body.category) ? body.category! : "puni";
  if (name.length < 2) return NextResponse.json({ error: "Upišite ime i prezime." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail nije ispravan." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Lozinka treba imati barem 8 znakova." }, { status: 400 });
  }

  try {
    const user = await updateStore((store) => {
      if (store.users.some((item) => item.email === email)) {
        throw new Error("Taj e-mail je već registriran.");
      }
      const created = {
        id: `u_${crypto.randomUUID().slice(0, 8)}`,
        email,
        name,
        role: "user" as const,
        category,
        favoriteLineIds: [],
        favoriteStopIds: [],
        passwordHash: hashPassword(password),
      };
      store.users.push(created);
      return created;
    });
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        category: user.category,
        favoriteLineIds: user.favoriteLineIds,
        favoriteStopIds: user.favoriteStopIds,
      },
    });
    response.cookies.set(SESSION_COOKIE, signSession(user.id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registracija nije uspjela.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
