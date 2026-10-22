import { NextResponse } from "next/server";
import { signSession, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const user = (await readStore()).users.find((item) => item.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "E-mail ili lozinka nisu točni." }, { status: 401 });
  }
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
}
