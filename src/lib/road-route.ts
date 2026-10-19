type LatLng = [number, number];

const CHUNK = 24;

function dist2(a: LatLng, b: LatLng) {
  const dlat = a[0] - b[0];
  const dlng = (a[1] - b[1]) * Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
  return dlat * dlat + dlng * dlng;
}

function roundPoint(lat: number, lng: number): LatLng {
  return [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];
}

function same(a: LatLng, b: LatLng) {
  return dist2(a, b) < 1e-10;
}

async function osrm(coords: LatLng[], radius: number) {
  const path = coords.map((coord) => `${coord[1].toFixed(5)},${coord[0].toFixed(5)}`).join(";");
  const radiusQuery = radius > 0 ? `&radiuses=${coords.map(() => radius).join(";")}` : "";
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false${radiusQuery}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Cesta nije dohvaćena (${response.status}).`);
  const data = (await response.json()) as {
    code?: string;
    routes?: { geometry?: { coordinates?: [number, number][] } }[];
    waypoints?: { location: [number, number] }[];
  };
  const coordinates = data.routes?.[0]?.geometry?.coordinates;
  if (data.code !== "Ok" || !coordinates?.length || !data.waypoints) throw new Error(data.code || "Nema ceste.");
  return {
    points: coordinates.map(([lng, lat]) => roundPoint(lat, lng)),
    snapped: data.waypoints.map((waypoint) => roundPoint(waypoint.location[1], waypoint.location[0]) as LatLng),
  };
}

async function routeOnce(coords: LatLng[]) {
  let last = "Cesta nije dohvaćena.";
  for (const radius of [500, 2500, 0]) {
    try {
      return await osrm(coords, radius);
    } catch (error) {
      last = error instanceof Error ? error.message : last;
    }
  }
  throw new Error(last);
}

function matchIndexes(points: LatLng[], snapped: LatLng[]) {
  const indexes: number[] = [];
  let cursor = 0;
  for (const waypoint of snapped) {
    let best = cursor;
    let bestD = Infinity;
    for (let index = cursor; index < points.length; index += 1) {
      const distance = dist2(points[index], waypoint);
      if (distance < bestD) {
        bestD = distance;
        best = index;
      }
    }
    indexes.push(best);
    cursor = best;
  }
  return indexes;
}

function dedupe(coords: LatLng[]) {
  const points: LatLng[] = [];
  const map: number[] = [];
  coords.forEach((coord) => {
    if (!points.length || !same(points[points.length - 1], coord)) points.push(coord);
    map.push(points.length - 1);
  });
  return { points, map };
}

/** Drive between the given points and return the road line plus where each input point landed. */
export async function routeAlongRoads(coords: LatLng[]) {
  if (coords.length < 2) {
    return { points: coords.map((coord) => roundPoint(coord[0], coord[1])), waypointIndexes: coords.map((_, index) => index) };
  }
  const compact = dedupe(coords);
  const pieces: LatLng[] = [];
  const compactIndexes: number[] = [];
  for (let start = 0; start < compact.points.length - 1; start += CHUNK - 1) {
    const slice = compact.points.slice(start, Math.min(compact.points.length, start + CHUNK));
    if (slice.length < 2) break;
    const routed = await routeOnce(slice);
    const local = matchIndexes(routed.points, routed.snapped);
    const origin = local[0] ?? 0;
    if (!pieces.length) {
      pieces.push(...routed.points.slice(origin));
      compactIndexes.push(...local.map((index) => index - origin));
      continue;
    }
    const join = pieces.length - 1;
    pieces.push(...routed.points.slice(origin + 1));
    compactIndexes.push(...local.slice(1).map((index) => join + (index - origin)));
  }
  const waypointIndexes = compact.map.map((index) => compactIndexes[index] ?? 0);
  for (let index = 1; index < waypointIndexes.length; index += 1) {
    if (waypointIndexes[index] > waypointIndexes[index - 1]) continue;
    const need = waypointIndexes[index - 1] + 1;
    if (need >= pieces.length) pieces.push(pieces[pieces.length - 1]);
    waypointIndexes[index] = waypointIndexes[index - 1] + 1;
  }
  return { points: pieces, waypointIndexes };
}
