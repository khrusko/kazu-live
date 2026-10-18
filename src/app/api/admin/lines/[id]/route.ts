import { NextResponse } from "next/server";
import { currentUser, updateStore } from "@/lib/store";
import type { DayType, Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS: DayType[] = ["radni", "subota", "nedjelja"];

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Samo administrator može mijenjati vozni red." }, { status: 403 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as {
    directions?: { id: string; trips: Trip[] }[];
    announce?: { title?: string; body?: string } | null;
  };
  if (!body.directions?.length) {
    return NextResponse.json({ error: "Nema izmjena." }, { status: 400 });
  }

  try {
    const line = await updateStore((store) => {
      const found = store.lines.find((item) => item.id === id);
      if (!found) throw new Error("Linija ne postoji.");
      for (const incoming of body.directions!) {
        const direction = found.directions.find((item) => item.id === incoming.id);
        if (!direction) throw new Error("Smjer ne postoji.");
        const trips: Trip[] = incoming.trips.map((trip, index) => {
          if (!DAYS.includes(trip.day)) throw new Error("Nepoznat dan prometa.");
          if (trip.times.length !== direction.stops.length) {
            throw new Error("Broj vremena ne odgovara broju stajališta.");
          }
          const times = trip.times.map((time) => {
            if (time == null || time === "") return null;
            if (!TIME_RE.test(time)) throw new Error(`Vrijeme ${time} nije u obliku HH:MM.`);
            return time;
          });
          if (!times.some(Boolean)) throw new Error("Polazak nema nijedno vrijeme.");
          return { id: trip.id || `${direction.id}-${trip.day}-${index}`, day: trip.day, times };
        });
        direction.trips = trips;
      }
      if (body.announce?.title && body.announce.body) {
        store.announcements.unshift({
          id: `ann_${crypto.randomUUID().slice(0, 8)}`,
          title: body.announce.title.trim(),
          body: body.announce.body.trim(),
          lineIds: [found.id],
          severity: "change",
          publishedAt: new Date().toISOString(),
        });
      }
      return found;
    });
    return NextResponse.json({ line });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spremanje nije uspjelo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
