import { NextResponse } from "next/server";
import { networkView, readBundledNetwork, readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(networkView(await readStore()));
  } catch (error) {
    try {
      return NextResponse.json(readBundledNetwork());
    } catch {
      const message = error instanceof Error ? error.message : "Vozni red nije dostupan.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
}
