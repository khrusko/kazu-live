import { distanceMeters } from "./geo";
import { headsign, stopMap, stopName } from "./schedule";
import { toMinutes } from "./time";
import type { DayType, Direction, Line, Stop, Trip } from "./types";

export type PlanLeg = {
  lineId: string;
  code: string;
  color: string;
  directionId: string;
  originStopId: string;
  originName: string;
  destinationStopId: string;
  destinationName: string;
  originIndex: number;
  destinationIndex: number;
  headsign: string;
  depart: string;
  arrive: string;
  departMinutes: number;
  arriveMinutes: number;
  walkMinutes: number;
  walkMeters: number;
};

export type Itinerary = {
  legs: PlanLeg[];
  departMinutes: number;
  arriveMinutes: number;
  transfers: number;
};

const WALK_MAX_M = 750;
const SAME_PLACE_M = 40;

type Appear = { line: Line; direction: Direction; index: number };
type Link = { alight: number; board: number; walkMinutes: number; walkMeters: number };

function appearances(lines: Line[]) {
  const map = new Map<string, Appear[]>();
  for (const line of lines) {
    for (const direction of line.directions) {
      direction.stops.forEach((stop, index) => {
        const list = map.get(stop.stopId) ?? [];
        list.push({ line, direction, index });
        map.set(stop.stopId, list);
      });
    }
  }
  return map;
}

function clock(depart: string, arrive: string) {
  const departMinutes = toMinutes(depart);
  let arriveMinutes = toMinutes(arrive);
  if (Number.isNaN(departMinutes) || Number.isNaN(arriveMinutes)) return null;
  if (arriveMinutes < departMinutes) arriveMinutes += 1440;
  return { departMinutes, arriveMinutes };
}

function makeLeg(
  line: Line,
  direction: Direction,
  trip: Trip,
  originIndex: number,
  destinationIndex: number,
  named: Map<string, Stop>,
  walkMinutes: number,
  walkMeters: number,
): PlanLeg | null {
  const depart = trip.times[originIndex];
  const arrive = trip.times[destinationIndex];
  if (!depart || !arrive) return null;
  const times = clock(depart, arrive);
  if (!times || times.arriveMinutes <= times.departMinutes) return null;
  const originStopId = direction.stops[originIndex].stopId;
  const destinationStopId = direction.stops[destinationIndex].stopId;
  return {
    lineId: line.id,
    code: line.code,
    color: line.color,
    directionId: direction.id,
    originStopId,
    originName: stopName(named, originStopId),
    destinationStopId,
    destinationName: stopName(named, destinationStopId),
    originIndex,
    destinationIndex,
    headsign: headsign(direction, named),
    depart,
    arrive,
    departMinutes: times.departMinutes,
    arriveMinutes: times.arriveMinutes,
    walkMinutes,
    walkMeters,
  };
}

function linksBetween(from: Appear, to: Appear, named: Map<string, Stop>): Link[] {
  const links: Link[] = [];
  for (let alight = from.index + 1; alight < from.direction.stops.length; alight += 1) {
    const alightId = from.direction.stops[alight].stopId;
    if (alightId === to.direction.stops[to.index].stopId) continue;
    const alightStop = named.get(alightId);
    if (!alightStop) continue;
    const choices: Link[] = [];
    for (let board = 0; board < to.index; board += 1) {
      const boardId = to.direction.stops[board].stopId;
      if (boardId === from.direction.stops[from.index].stopId) continue;
      const boardStop = named.get(boardId);
      if (!boardStop) continue;
      const same = boardId === alightId;
      const meters = same ? 0 : distanceMeters(alightStop, boardStop);
      if (!same && meters > WALK_MAX_M) continue;
      const walkMeters = meters < SAME_PLACE_M ? 0 : Math.round(meters);
      choices.push({
        alight,
        board,
        walkMeters,
        walkMinutes: walkMeters === 0 ? 0 : Math.max(3, Math.round(walkMeters / 75)),
      });
    }
    choices.sort((a, b) => a.walkMinutes - b.walkMinutes || a.board - b.board);
    links.push(...choices.slice(0, 3));
  }
  return links;
}

function earliestSecond(to: Appear, trip: Trip, ready: number, board: number, named: Map<string, Stop>) {
  let best: PlanLeg | null = null;
  for (const candidate of to.direction.trips) {
    if (candidate.day !== trip.day) continue;
    const leg = makeLeg(to.line, to.direction, candidate, board, to.index, named, 0, 0);
    if (!leg || leg.departMinutes < ready) continue;
    if (!best || leg.departMinutes < best.departMinutes) best = leg;
  }
  return best;
}

export function planJourneys(
  lines: Line[],
  stops: Stop[],
  originId: string,
  destinationId: string,
  day: DayType,
  fromMinutes: number,
): Itinerary[] {
  if (!originId || !destinationId || originId === destinationId) return [];
  const named = stopMap(stops);
  const index = appearances(lines);
  const found: Itinerary[] = [];
  const seen = new Set<string>();

  function push(item: Itinerary) {
    if (item.departMinutes < fromMinutes) return;
    if (item.arriveMinutes - item.departMinutes > 300) return;
    const key = item.legs.map((leg) => `${leg.code}|${leg.depart}|${leg.originStopId}|${leg.destinationStopId}|${leg.arrive}`).join(">");
    if (seen.has(key)) return;
    seen.add(key);
    found.push(item);
  }

  for (const from of index.get(originId) ?? []) {
    for (let destination = from.index + 1; destination < from.direction.stops.length; destination += 1) {
      if (from.direction.stops[destination].stopId !== destinationId) continue;
      for (const trip of from.direction.trips) {
        if (trip.day !== day) continue;
        const leg = makeLeg(from.line, from.direction, trip, from.index, destination, named, 0, 0);
        if (!leg) continue;
        push({ legs: [leg], departMinutes: leg.departMinutes, arriveMinutes: leg.arriveMinutes, transfers: 0 });
      }
    }
  }

  for (const from of index.get(originId) ?? []) {
    for (const to of index.get(destinationId) ?? []) {
      if (from.direction.id === to.direction.id) continue;
      const links = linksBetween(from, to, named);
      if (!links.length) continue;
      for (const trip of from.direction.trips) {
        if (trip.day !== day) continue;
        let best: Itinerary | null = null;
        for (const link of links) {
          const first = makeLeg(from.line, from.direction, trip, from.index, link.alight, named, 0, 0);
          if (!first || first.departMinutes < fromMinutes) continue;
          const pad = link.walkMinutes > 0 ? link.walkMinutes : 1;
          const second = earliestSecond(to, trip, first.arriveMinutes + pad, link.board, named);
          if (!second) continue;
          second.walkMinutes = link.walkMinutes;
          second.walkMeters = link.walkMeters;
          const item: Itinerary = {
            legs: [first, second],
            departMinutes: first.departMinutes,
            arriveMinutes: second.arriveMinutes,
            transfers: 1,
          };
          const walk = item.legs[1]?.walkMinutes ?? 0;
          const bestWalk = best?.legs[1]?.walkMinutes ?? 0;
          if (!best || item.arriveMinutes < best.arriveMinutes || (item.arriveMinutes === best.arriveMinutes && walk < bestWalk)) {
            best = item;
          }
        }
        if (best) push(best);
      }
    }
  }

  const bestByDeparture = new Map<string, Itinerary>();
  for (const item of found) {
    const key = `${item.departMinutes}|${item.legs[0].lineId}|${item.legs[0].originStopId}`;
    const have = bestByDeparture.get(key);
    const better =
      !have ||
      item.arriveMinutes < have.arriveMinutes ||
      (item.arriveMinutes === have.arriveMinutes && item.transfers < have.transfers);
    if (better) bestByDeparture.set(key, item);
  }
  const unique = [...bestByDeparture.values()];
  const directs = unique.filter((item) => item.transfers === 0);
  return unique
    .filter((item) => {
      if (item.transfers === 0) return true;
      return !directs.some((direct) => direct.departMinutes <= item.departMinutes && direct.arriveMinutes <= item.arriveMinutes);
    })
    .sort((a, b) => a.departMinutes - b.departMinutes || a.arriveMinutes - b.arriveMinutes || a.transfers - b.transfers)
    .slice(0, 4);
}
