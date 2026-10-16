import { NextResponse } from "next/server";
import { networkView, readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json(networkView(readStore()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vozni red nije dostupan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
