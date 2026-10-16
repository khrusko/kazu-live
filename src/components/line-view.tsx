"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useKazu } from "@/components/providers";
import { headsign, stopMap } from "@/lib/schedule";
import { DAY_LABEL, formatWait, showTime, toMinutes, zagrebParts } from "@/lib/time";
import type { DayType, Direction } from "@/lib/types";

export function LineView({ id }: { id: string }) {
  const params = useSearchParams();
  const currentStopId = params.get("stop");
  const { network, loading, error, favoriteLineIds, toggleLine } = useKazu();
  const line = network?.lines.find((item) => item.id === id);
  const groups = useMemo(() => {
    const map = new Map<string, Direction[]>();
    for (const direction of line?.directions ?? []) {
      map.set(direction.name, [...(map.get(direction.name) ?? []), direction]);
    }
    return [...map.entries()];
  }, [line]);
  const [groupIndex, setGroupIndex] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);
  const [day, setDay] = useState<DayType>(zagrebParts().day);
  const named = stopMap(network?.stops ?? []);
  const variants = groups[groupIndex]?.[1] ?? [];
  const direction = variants[Math.min(variantIndex, Math.max(variants.length - 1, 0))];
  const days = (["radni", "subota", "nedjelja"] as DayType[]).filter((item) =>
    direction?.trips.some((trip) => trip.day === item),
  );
  const activeDay = days.includes(day) ? day : days[0];
  const trips = direction?.trips.filter((trip) => trip.day === activeDay) ?? [];
  const [now, setNow] = useState(() => zagrebParts());
  useEffect(() => {
    const timer = setInterval(() => setNow(zagrebParts()), 30000);
    return () => clearInterval(timer);
  }, []);
  const today = activeDay === now.day;
  const nextTrip = today
    ? trips.find((trip) => trip.times.some((time) => time && toMinutes(time) >= now.minutes))
    : undefined;
  const rowRef = useRef<HTMLTableRowElement>(null);
  const hereName = currentStopId ? named.get(currentStopId)?.name : null;
  useEffect(() => {
    rowRef.current?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [currentStopId, direction?.id, activeDay]);

  if (loading) return <p className="p-8 text-sm text-muted-foreground">Učitavam liniju…</p>;
  if (error) return <p className="p-8 text-sm">{error}</p>;
  if (!line || !direction) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <p>Linija nije u voznom redu.</p>
        <Link href="/linije" className="text-sm text-primary">Sve linije</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <Link href="/linije" className="text-sm text-muted-foreground">Sve linije</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="text-white" style={{ background: line.color }}>{line.code}</Badge>
            {line.validFrom && <span className="text-xs text-muted-foreground">vrijedi od {line.validFrom}</span>}
          </div>
          <h1 className="font-display mt-2 text-3xl">{line.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {direction.label}. Podaci su preuzeti sa službenih rasporeda na kazup.hr.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => toggleLine(line.id).catch((reason: Error) => toast.error(reason.message))}
          >
            <Heart className={`size-4 ${favoriteLineIds.includes(line.id) ? "fill-current text-[oklch(0.55_0.16_35)]" : ""}`} />
            {favoriteLineIds.includes(line.id) ? "U favoritima" : "Favorit"}
          </Button>
          <Button size="lg" nativeButton={false} render={<Link href={`/karta?linija=${line.id}${currentStopId ? `&stop=${currentStopId}` : ""}`} />}>Na karti</Button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {groups.map(([name], index) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              setGroupIndex(index);
              setVariantIndex(0);
            }}
            className={`rounded-full px-3 py-1.5 text-sm ${index === groupIndex ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {name}
          </button>
        ))}
      </div>
      {variants.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {variants.map((variant, index) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => setVariantIndex(index)}
              className={`rounded-full px-3 py-1 text-xs ${index === variantIndex ? "bg-foreground text-background" : "bg-muted"}`}
            >
              {variant.label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {days.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setDay(item)}
            className={`rounded-full px-3 py-1 text-sm ${item === activeDay ? "bg-accent text-accent-foreground" : "bg-muted"}`}
          >
            {DAY_LABEL[item]}
          </button>
        ))}
      </div>

      {hereName && (
        <p className="mt-4 rounded-2xl bg-accent px-3 py-2 text-sm text-accent-foreground">
          Istaknuto je stajalište {hereName}: polasci s njega i dolasci na njega.
        </p>
      )}
      <div className="mt-4 overflow-auto rounded-2xl bg-card ring-1 ring-foreground/10">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted text-left">
              <th className="sticky left-0 z-10 min-w-40 bg-muted px-3 py-2 font-medium">Stajalište</th>
              <th className="px-3 py-2 font-medium">km</th>
              {trips.map((trip, index) => (
                <th key={trip.id} className={`px-3 py-2 font-medium ${trip.id === nextTrip?.id ? "bg-accent" : ""}`}>
                  {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {direction.stops.map((stop, row) => {
              const here = stop.stopId === currentStopId;
              const firstHere = here && direction.stops.findIndex((item) => item.stopId === currentStopId) === row;
              return (
                <tr key={`${stop.stopId}-${row}`} ref={firstHere ? rowRef : undefined} className={here ? "bg-accent" : "border-t"}>
                  <td className={`sticky left-0 px-3 py-2 ${here ? "bg-accent font-medium" : "bg-card"}`}>
                    <Link href={`/karta?stop=${stop.stopId}&linija=${line.id}`} className="hover:underline">
                      {named.get(stop.stopId)?.name ?? stop.stopId}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{stop.km.toFixed(1)}</td>
                  {trips.map((trip) => {
                    const time = trip.times[row];
                    const delta = time && today ? toMinutes(time) - now.minutes : null;
                    return (
                      <td key={trip.id} className={`px-3 py-2 tabular-nums ${here ? "bg-accent" : trip.id === nextTrip?.id ? "bg-accent/60" : ""}`}>
                        {time ? (
                          <span className="block">
                            <span className={delta != null && delta < 0 ? "text-muted-foreground" : ""}>{showTime(time)}</span>
                            {delta != null && (
                              <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                                {delta < 0 ? "prošlo" : formatWait(delta)}
                              </span>
                            )}
                          </span>
                        ) : (
                          "·"
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Smjer završava u: {headsign(direction, named)}.{" "}
        <a className="underline" href={line.sourcePdf} target="_blank" rel="noreferrer">
          Izvorni PDF
        </a>
      </p>
    </div>
  );
}
