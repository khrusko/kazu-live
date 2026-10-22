import { NextResponse } from "next/server";
import { quoteFare } from "@/lib/fares";
import { findRides } from "@/lib/schedule";
import { currentUser, readStore, updateStore } from "@/lib/store";
import type { CategoryId, TicketType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPES: TicketType[] = ["jednokratna", "dnevna", "mjesecna", "godisnja"];

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Prijavite se." }, { status: 401 });
  const tickets = (await readStore()).tickets.filter((ticket) => user.role === "admin" || ticket.userId === user.id);
  return NextResponse.json({ tickets: tickets.slice().reverse() });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Za izdavanje karte potreban je račun." }, { status: 401 });
  const body = (await request.json()) as {
    lineId?: string;
    originStopId?: string;
    destinationStopId?: string;
    ticketType?: TicketType;
    category?: CategoryId;
  };
  if (!body.lineId || !body.originStopId || !body.destinationStopId || !body.ticketType || !body.category) {
    return NextResponse.json({ error: "Nedostaje relacija, vrsta karte ili popust." }, { status: 400 });
  }
  if (!TYPES.includes(body.ticketType)) {
    return NextResponse.json({ error: "Nepoznata vrsta karte." }, { status: 400 });
  }

  try {
    const ticket = await updateStore((store) => {
      const rides = findRides(
        store.lines.filter((line) => line.id === body.lineId),
        body.originStopId!,
        body.destinationStopId!,
      );
      const ride = rides[0];
      if (!ride) throw new Error("Na toj liniji nema vožnje od polazišta do odredišta.");
      const origin = store.stops.find((stop) => stop.id === body.originStopId);
      const destination = store.stops.find((stop) => stop.id === body.destinationStopId);
      if (!origin || !destination) throw new Error("Stajalište ne postoji.");
      const touristDailyUsed = store.tickets.filter(
        (item) => item.userId === user.id && item.category === "turist" && item.ticketType === "dnevna",
      ).length;
      const priced = quoteFare({
        km: ride.km,
        ticketType: body.ticketType!,
        category: body.category!,
        touristDailyUsed,
      });
      const created = {
        id: `k_${crypto.randomUUID().slice(0, 8)}`,
        userId: user.id,
        lineId: ride.line.id,
        directionId: ride.direction.id,
        originStopId: origin.id,
        destinationStopId: destination.id,
        originName: origin.name,
        destinationName: destination.name,
        lineCode: ride.line.code,
        km: ride.km,
        zone: priced.zone.id,
        ticketType: body.ticketType!,
        category: body.category!,
        basePrice: priced.base,
        discountPercent: priced.percent,
        price: priced.price,
        status: "izdano" as const,
        createdAt: new Date().toISOString(),
        payment: "placeholder" as const,
      };
      store.tickets.push(created);
      return created;
    }, false);
    return NextResponse.json({ ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Karta nije izdana.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
