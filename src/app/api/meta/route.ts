import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const store = readStore();
    return NextResponse.json({ version: store.version, updatedAt: store.updatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nema podataka.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
