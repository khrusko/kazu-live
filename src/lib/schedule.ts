import type { DayType, Direction, Line, Stop, Trip } from "./types";
import { toMinutes } from "./time";

export type Departure = {
  lineId: string;
  code: string;
  color: string;
  directionId: string;
  directionName: string;
  headsign: string;
  time: string;
  minutes: number;
  day: DayType;
  tripId: string;
};

export type LiveBus = {
  id: string;
  lineId: string;
  code: string;
  color: string;
  lat: number;
  lng: number;
  headsign: string;
  from: string;
  to: string;
};

export type Ride = {
  line: Line;
  direction: Direction;
  originIndex: number;
  destinationIndex: number;
  km: number;
};

export function stopMap(stops: Stop[]) {
  return new Map(stops.map((stop) => [stop.id, stop]));
}

export function stopName(stops: Map<string, Stop>, id: string) {
  return stops.get(id)?.name ?? id;
}

export function headsign(direction: Direction, stops: Map<string, Stop>) {
  const last = direction.stops[direction.stops.length - 1];
  return last ? stopName(stops, last.stopId) : direction.name;
}

export function linesAtStop(lines: Line[], stopId: string) {
  return lines.filter((line) =>
    line.directions.some((direction) => direction.stops.some((stop) => stop.stopId === stopId)),
  );
}

export function departuresForStop(lines: Line[], stops: Stop[], stopId: string, day: DayType): Departure[] {
  const named = stopMap(stops);
  const rows: Departure[] = [];
  for (const line of lines) {
    for (const direction of line.directions) {
      const indexes = direction.stops
        .map((stop, index) => (stop.stopId === stopId ? index : -1))
        .filter((index) => index >= 0);
      if (!indexes.length) continue;
      const sign = headsign(direction, named);
      for (const trip of direction.trips) {
        if (trip.day !== day) continue;
        for (const index of indexes) {
          const time = trip.times[index];
          if (!time) continue;
          rows.push({
            lineId: line.id,
            code: line.code,
            color: line.color,
            directionId: direction.id,
            directionName: direction.name,
            headsign: sign,
            time,
            minutes: toMinutes(time),
            day: trip.day,
            tripId: trip.id,
          });
        }
      }
    }
  }
  return rows.sort((a, b) => a.minutes - b.minutes || a.code.localeCompare(b.code));
}

export function liveBuses(lines: Line[], stops: Stop[], day: DayType, minutes: number): LiveBus[] {
  const named = stopMap(stops);
  const buses: LiveBus[] = [];
  for (const line of lines) {
    for (const direction of line.directions) {
      for (const trip of direction.trips) {
        if (trip.day !== day) continue;
        const placed = placeOnTrip(direction, trip, minutes, named);
        if (!placed) continue;
        buses.push({
          id: `${line.id}-${direction.id}-${trip.id}`,
          lineId: line.id,
          code: line.code,
          color: line.color,
          lat: placed.lat,
          lng: placed.lng,
          headsign: headsign(direction, named),
          from: placed.from,
          to: placed.to,
        });
      }
    }
  }
  return buses;
}

export function legShape(direction: Direction, from: number, to: number): [number, number][] {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  if (direction.shape && direction.shapeAnchors && direction.shapeAnchors.length === direction.stops.length) {
    const a = direction.shapeAnchors[start];
    const b = direction.shapeAnchors[end];
    if (a != null && b != null) {
      const slice = direction.shape.slice(Math.min(a, b), Math.max(a, b) + 1);
      if (slice.length) return slice;
    }
  }
  return direction.geometry.slice(start, end + 1).filter((point): point is [number, number] => Boolean(point));
}

export function stopOnShape(direction: Direction, index: number): [number, number] | null {
  const anchor = direction.shapeAnchors?.[index];
  if (direction.shape && anchor != null && direction.shape[anchor]) return direction.shape[anchor];
  return direction.geometry[index] ?? null;
}

function pointAlong(line: [number, number][], ratio: number): [number, number] {
  if (!line.length) return [0, 0];
  if (line.length === 1 || ratio <= 0) return line[0];
  if (ratio >= 1) return line[line.length - 1];
  const lengths: number[] = [];
  let total = 0;
  for (let index = 1; index < line.length; index += 1) {
    const dLat = line[index][0] - line[index - 1][0];
    const dLng = line[index][1] - line[index - 1][1];
    const length = Math.hypot(dLat, dLng);
    lengths.push(length);
    total += length;
  }
  if (total === 0) return line[0];
  let remain = total * ratio;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remain <= lengths[index] || index === lengths.length - 1) {
      const t = lengths[index] === 0 ? 0 : remain / lengths[index];
      return [
        line[index][0] + (line[index + 1][0] - line[index][0]) * t,
        line[index][1] + (line[index + 1][1] - line[index][1]) * t,
      ];
    }
    remain -= lengths[index];
  }
  return line[line.length - 1];
}

function placeOnTrip(
  direction: Direction,
  trip: Trip,
  minutes: number,
  stops: Map<string, Stop>,
) {
  const points = direction.stops
    .map((stop, index) => {
      const time = trip.times[index];
      if (!time || !stopOnShape(direction, index)) return null;
      return {
        minutes: toMinutes(time),
        index,
        name: stopName(stops, stop.stopId),
      };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  if (points.length < 2) return null;
  if (minutes < points[0].minutes || minutes > points[points.length - 1].minutes) return null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (minutes < start.minutes || minutes > end.minutes) continue;
    const span = end.minutes - start.minutes || 1;
    const ratio = Math.min(1, Math.max(0, (minutes - start.minutes) / span));
    const [lat, lng] = pointAlong(legShape(direction, start.index, end.index), ratio);
    return { lat, lng, from: start.name, to: end.name };
  }
  return null;
}

export function findRides(lines: Line[], originId: string, destinationId: string): Ride[] {
  const rides: Ride[] = [];
  for (const line of lines) {
    let best: Ride | null = null;
    for (const direction of line.directions) {
      for (let origin = 0; origin < direction.stops.length; origin += 1) {
        if (direction.stops[origin].stopId !== originId) continue;
        for (let destination = origin + 1; destination < direction.stops.length; destination += 1) {
          if (direction.stops[destination].stopId !== destinationId) continue;
          const km = Math.round((direction.stops[destination].km - direction.stops[origin].km) * 10) / 10;
          if (km <= 0) continue;
          const ride = { line, direction, originIndex: origin, destinationIndex: destination, km };
          if (!best || ride.km < best.km) best = ride;
        }
      }
    }
    if (best) rides.push(best);
  }
  return rides.sort((a, b) => a.km - b.km || a.line.code.localeCompare(b.line.code));
}

export const GROUP_LABEL: Record<string, string> = {
  A: "Iz Karlovca",
  B: "Ogulin i okolica",
  C: "Slunj i okolica",
  D: "Duga Resa i okolica",
  E: "Veze izvan županije",
};
