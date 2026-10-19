type LatLng = [number, number];

export type RoutedLine = {
  points: LatLng[];
  waypointIndexes: number[];
};

export type DirectionDraft = {
  id: string;
  stops: { stopId: string }[];
  points: LatLng[];
  anchors: number[];
  /** Stop row whose reconnected slice should be reported back to the editor. */
  focusStopIndex?: number;
};

export type ReconnectedDirection = {
  id: string;
  points: LatLng[];
  anchors: number[];
  routed: boolean;
  focus: { from: number; to: number } | null;
};

type RouteFn = (coords: LatLng[]) => Promise<RoutedLine>;

type Piece = {
  from: number;
  to: number;
  via: LatLng[];
  stopIndexes: number[];
  stopVias: number[];
};

function clone(point: LatLng): LatLng {
  return [point[0], point[1]];
}

function pieceFor(points: LatLng[], anchor: number, stopIndex: number, stop: LatLng): Piece {
  if (!Number.isInteger(anchor) || anchor < 0 || anchor >= points.length) {
    throw new Error("Čvor stajališta nije na cesti.");
  }
  if (points.length === 1) {
    return { from: 0, to: 0, via: [clone(stop)], stopIndexes: [stopIndex], stopVias: [0] };
  }
  if (anchor === 0) {
    return { from: 0, to: 1, via: [clone(stop), clone(points[1])], stopIndexes: [stopIndex], stopVias: [0] };
  }
  if (anchor === points.length - 1) {
    const from = points.length - 2;
    return { from, to: anchor, via: [clone(points[from]), clone(stop)], stopIndexes: [stopIndex], stopVias: [1] };
  }
  return {
    from: anchor - 1,
    to: anchor + 1,
    via: [clone(points[anchor - 1]), clone(stop), clone(points[anchor + 1])],
    stopIndexes: [stopIndex],
    stopVias: [1],
  };
}

/** Overlapping windows (the same stop twice, with nothing between) become one route. */
function mergePieces(pieces: Piece[]): Piece[] {
  const sorted = pieces.slice().sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: Piece[] = [];
  for (const piece of sorted) {
    const last = merged[merged.length - 1];
    if (!last || piece.from > last.to) {
      merged.push({
        from: piece.from,
        to: piece.to,
        via: piece.via.map(clone),
        stopIndexes: piece.stopIndexes.slice(),
        stopVias: piece.stopVias.slice(),
      });
      continue;
    }
    const startsAtStop = last.stopVias[0] === 0;
    const endsAtStop = piece.stopVias[piece.stopVias.length - 1] === piece.via.length - 1;
    const via: LatLng[] = [];
    if (!startsAtStop) via.push(clone(last.via[0]));
    for (const at of last.stopVias) via.push(clone(last.via[at]));
    for (const at of piece.stopVias) via.push(clone(piece.via[at]));
    if (!endsAtStop) via.push(clone(piece.via[piece.via.length - 1]));
    const stopCount = last.stopIndexes.length + piece.stopIndexes.length;
    const stopVias = Array.from({ length: stopCount }, (_, index) => index + (startsAtStop ? 0 : 1));
    last.from = Math.min(last.from, piece.from);
    last.to = Math.max(last.to, piece.to);
    last.via = via;
    last.stopIndexes = last.stopIndexes.concat(piece.stopIndexes);
    last.stopVias = stopVias;
  }
  return merged;
}

function fallbackSlice(points: LatLng[], piece: Piece, anchors: number[], stop: LatLng): { points: LatLng[]; offsets: number[] } {
  const inserted = points.slice(piece.from, piece.to + 1).map(clone);
  const offsets = piece.stopIndexes.map((stopIndex) => anchors[stopIndex] - piece.from);
  offsets.forEach((offset) => {
    if (inserted[offset]) inserted[offset] = clone(stop);
  });
  return { points: inserted, offsets };
}

/** Keep the routed road, but put the stop and its neighbour vertices back on their exact coordinates. */
function pinnedSlice(routed: RoutedLine, via: LatLng[], stopVias: number[]): { points: LatLng[]; offsets: number[] } | null {
  const indexes = routed.waypointIndexes;
  if (!routed.points?.length || indexes?.length !== via.length) return null;
  const start = indexes[0];
  const end = indexes[indexes.length - 1];
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end >= routed.points.length || start > end) return null;
  const local = indexes.map((index) => index - start);
  for (let index = 0; index < local.length; index += 1) {
    if (!Number.isInteger(local[index]) || local[index] < 0 || local[index] >= end - start + 1) return null;
    if (index > 0 && local[index] <= local[index - 1]) return null;
  }
  const points = routed.points.slice(start, end + 1).map(clone);
  via.forEach((coord, index) => {
    points[local[index]] = clone(coord);
  });
  return { points, offsets: stopVias.map((index) => local[index]) };
}

function applySlice(
  points: LatLng[],
  anchors: number[],
  piece: Piece,
  inserted: LatLng[],
  offsets: number[],
): { points: LatLng[]; anchors: number[] } {
  const nextPoints = points.slice(0, piece.from).concat(inserted.map(clone), points.slice(piece.to + 1));
  const delta = inserted.length - (piece.to - piece.from + 1);
  const moved = new Map(piece.stopIndexes.map((stopIndex, index) => [stopIndex, piece.from + offsets[index]]));
  const nextAnchors = anchors.map((anchor, index) => {
    const at = moved.get(index);
    if (at != null) return at;
    if (anchor < piece.from) return anchor;
    if (anchor > piece.to) return anchor + delta;
    if (anchor === piece.from) return piece.from;
    if (anchor === piece.to) return piece.from + inserted.length - 1;
    return anchor;
  });
  return { points: nextPoints, anchors: nextAnchors };
}

function saveable(points: LatLng[], anchors: number[], stopCount: number, accept: (point: LatLng) => boolean) {
  if (anchors.length !== stopCount || points.length < 2 || points.length > 8000) return false;
  let previous = -1;
  for (const anchor of anchors) {
    if (!Number.isInteger(anchor) || anchor <= previous || anchor >= points.length) return false;
    previous = anchor;
  }
  return points.every((point) => accept(point));
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/**
 * Redraw only the road from the previous vertex through the moved stop to the next vertex.
 * End vertices stay put. A stop at either end redraws just that end segment.
 * When routing fails, the stop vertex still moves so the join is not dropped.
 */
export async function reconnectDirections(
  directions: DirectionDraft[],
  stopId: string,
  stop: LatLng,
  route: RouteFn,
  accept: (point: LatLng) => boolean = () => true,
): Promise<ReconnectedDirection[]> {
  const pending = directions.filter((direction) => direction.stops.some((call) => call.stopId === stopId));
  return mapPool(pending, 3, async (direction) => {
    let points = direction.points.map(clone);
    let anchors = direction.anchors.slice();
    if (!saveable(points, anchors, direction.stops.length, accept)) {
      throw new Error("Cesta u nacrtu nije ispravna.");
    }
    const pieces = mergePieces(
      direction.stops.flatMap((call, stopIndex) =>
        call.stopId === stopId ? [pieceFor(points, anchors[stopIndex], stopIndex, stop)] : [],
      ),
    );
    const routedPieces = await mapPool(pieces, 3, async (piece) => {
      if (piece.via.length < 2) return { routed: false as const };
      try {
        const routed = await route(piece.via.map(clone));
        const pinned = pinnedSlice(routed, piece.via, piece.stopVias);
        if (!pinned || pinned.points.some((point) => !accept(point))) return { routed: false as const };
        return { routed: true as const, ...pinned };
      } catch {
        return { routed: false as const };
      }
    });

    let routed = true;
    let focus: { from: number; to: number } | null = null;
    const ordered = pieces.map((piece, index) => ({ piece, result: routedPieces[index] })).sort((a, b) => b.piece.from - a.piece.from);
    for (const item of ordered) {
      const inserted = item.result.routed
        ? { points: item.result.points, offsets: item.result.offsets }
        : fallbackSlice(points, item.piece, anchors, stop);
      if (!item.result.routed) routed = false;
      const delta = inserted.points.length - (item.piece.to - item.piece.from + 1);
      if (focus) focus = { from: focus.from + delta, to: focus.to + delta };
      const next = applySlice(points, anchors, item.piece, inserted.points, inserted.offsets);
      points = next.points;
      anchors = next.anchors;
      if (direction.focusStopIndex != null && item.piece.stopIndexes.includes(direction.focusStopIndex)) {
        focus = { from: item.piece.from, to: item.piece.from + inserted.points.length - 1 };
      }
    }
    if (!saveable(points, anchors, direction.stops.length, accept)) {
      throw new Error("Nova ruta nije ispravna.");
    }
    return { id: direction.id, points, anchors, routed, focus };
  });
}
