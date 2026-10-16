"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKazu } from "@/components/providers";
import { stopMap } from "@/lib/schedule";
import { DAY_LABEL } from "@/lib/time";
import type { DayType, Direction, Trip } from "@/lib/types";

export default function AdminLinePage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const { network, user, loading, refresh } = useKazu();
  const line = network?.lines.find((item) => item.id === id);
  const [directions, setDirections] = useState<Direction[] | null>(null);
  const [directionId, setDirectionId] = useState("");
  const [announce, setAnnounce] = useState(true);
  const [busy, setBusy] = useState(false);
  const named = stopMap(network?.stops ?? []);

  useEffect(() => {
    if (line && !directions) {
      setDirections(structuredClone(line.directions));
      setDirectionId(line.directions[0]?.id ?? "");
    }
  }, [line, directions]);

  if (loading) return <p className="p-8 text-sm">Učitavam…</p>;
  if (!user || user.role !== "admin") {
    return <p className="p-8 text-sm">Samo dispečer. <Link href="/prijava?next=/admin" className="text-primary">Prijava</Link></p>;
  }
  if (!line || !directions) return <p className="p-8 text-sm">Linija nije nađena.</p>;
  const direction = directions.find((item) => item.id === directionId) ?? directions[0];

  function updateTime(tripId: string, index: number, value: string) {
    setDirections((current) =>
      current?.map((item) =>
        item.id !== direction.id
          ? item
          : {
              ...item,
              trips: item.trips.map((trip) =>
                trip.id !== tripId ? trip : { ...trip, times: trip.times.map((time, i) => (i === index ? value : time)) },
              ),
            },
      ) ?? null,
    );
  }

  function addTrip(day: DayType) {
    const blank: Trip = {
      id: `${direction.id}-${day}-${crypto.randomUUID().slice(0, 6)}`,
      day,
      times: direction.stops.map(() => ""),
    };
    const template = [...direction.trips].reverse().find((trip) => trip.day === day);
    if (template) blank.times = [...template.times];
    setDirections((current) =>
      current?.map((item) => (item.id === direction.id ? { ...item, trips: [...item.trips, blank] } : item)) ?? null,
    );
  }

  function removeTrip(tripId: string) {
    setDirections((current) =>
      current?.map((item) =>
        item.id === direction.id ? { ...item, trips: item.trips.filter((trip) => trip.id !== tripId) } : item,
      ) ?? null,
    );
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        directions: directions!.map((item) => ({
          id: item.id,
          trips: item.trips.map((trip) => ({
            ...trip,
            times: trip.times.map((time) => (time ? time : null)),
          })),
        })),
        announce: announce
          ? {
              title: `Izmjena voznog reda linije ${line!.code}`,
              body: `Dispečer je ažurirao polaske linije ${line!.code} (${line!.name}). Provjerite vozni red na karti.`,
            }
          : null,
      };
      const response = await fetch(`/api/admin/lines/${line!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Spremanje nije uspjelo.");
      await refresh();
      setDirections(null);
      toast.success("Vozni red je objavljen.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška.");
    } finally {
      setBusy(false);
    }
  }

  const days: DayType[] = ["radni", "subota", "nedjelja"];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <Link href="/admin" className="text-sm text-muted-foreground">Dispečer</Link>
      <h1 className="font-display mt-1 text-3xl">{line.code} · {line.name}</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        {directions.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setDirectionId(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm ${item.id === direction.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {item.name} · {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {days.map((day) => (
          <Button key={day} variant="outline" size="sm" onClick={() => addTrip(day)}>
            + {DAY_LABEL[day]}
          </Button>
        ))}
      </div>
      <div className="mt-4 overflow-auto rounded-2xl bg-card ring-1 ring-foreground/10">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-muted text-left">
              <th className="sticky left-0 z-10 bg-muted px-2 py-2">Stajalište</th>
              {direction.trips.map((trip) => (
                <th key={trip.id} className="px-2 py-2 font-medium">
                  <span className="block">{DAY_LABEL[trip.day]}</span>
                  <button type="button" className="text-destructive" onClick={() => removeTrip(trip.id)}>
                    obriši
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {direction.stops.map((stop, index) => (
              <tr key={`${stop.stopId}-${index}`} className="border-t">
                <td className="sticky left-0 bg-card px-2 py-1 whitespace-nowrap">
                  {named.get(stop.stopId)?.name ?? stop.stopId}
                  <span className="ml-1 text-muted-foreground">{stop.km}</span>
                </td>
                {direction.trips.map((trip) => (
                  <td key={trip.id} className="px-1 py-1">
                    <Input
                      value={trip.times[index] ?? ""}
                      onChange={(event) => updateTime(trip.id, index, event.target.value)}
                      className="h-7 w-16 px-1 text-xs"
                      placeholder="—"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={announce} onChange={(event) => setAnnounce(event.target.checked)} />
        Objavi obavijest putnicima koji prate ovu liniju
      </label>
      <Button className="mt-3" size="lg" disabled={busy} onClick={save}>
        {busy ? "Spremam…" : "Objavi izmjenu"}
      </Button>
    </div>
  );
}
