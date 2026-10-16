import fs from "fs";

const network = JSON.parse(fs.readFileSync("data/network.json", "utf8"));
const stops = new Map(network.stops.map((stop) => [stop.id, stop]));
const outPath = "data/roads.json";
const partialPath = "data/roads.json.tmp";

const existing = fs.existsSync(partialPath)
  ? JSON.parse(fs.readFileSync(partialPath, "utf8"))
  : fs.existsSync(outPath)
    ? JSON.parse(fs.readFileSync(outPath, "utf8"))
    : {};

function sameCoord(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-5 && Math.abs(a[1] - b[1]) < 1e-5;
}

function dist2(a, b) {
  const dlat = a[0] - b[0];
  const dlng = (a[1] - b[1]) * Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
  return dlat * dlat + dlng * dlng;
}

function distPointSeg(p, a, b) {
  const l2 = dist2(a, b);
  if (l2 === 0) return Math.sqrt(dist2(p, a));
  let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]) * Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180)) ** 2) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt(dist2(p, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]));
}

function douglas(points, eps) {
  if (points.length <= 2) return points.slice();
  let max = 0;
  let index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i += 1) {
    const d = distPointSeg(points[i], points[0], points[last]);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max > eps) {
    const left = douglas(points.slice(0, index + 1), eps);
    const right = douglas(points.slice(index), eps);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[last]];
}

function roundPoint(lat, lng) {
  return [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];
}

async function osrm(coords, radius) {
  const path = coords.map((coord) => `${coord[1].toFixed(6)},${coord[0].toFixed(6)}`).join(";");
  const radiusQuery = radius ? `&radiuses=${coords.map(() => radius).join(";")}` : "";
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false${radiusQuery}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates) {
    throw new Error(data.code || "no route");
  }
  const points = data.routes[0].geometry.coordinates.map(([lng, lat]) => roundPoint(lat, lng));
  const snapped = data.waypoints.map((waypoint) => [waypoint.location[1], waypoint.location[0]]);
  const legs = data.routes[0].legs.map((leg) => leg.distance / 1000);
  return { points, snapped, legs };
}

async function routeCoords(coords) {
  if (coords.length < 2) {
    return { points: coords.map((coord) => roundPoint(coord[0], coord[1])), snapped: coords, legs: [] };
  }
  const attempts = [800, 2500, 0];
  let last = "fail";
  for (const radius of attempts) {
    try {
      return await osrm(coords, radius);
    } catch (error) {
      last = error instanceof Error ? error.message : "fail";
    }
  }
  if (coords.length > 6) {
    const mid = Math.floor(coords.length / 2);
    const left = await routeCoords(coords.slice(0, mid + 1));
    await new Promise((resolve) => setTimeout(resolve, 200));
    const right = await routeCoords(coords.slice(mid));
    const points = left.points.concat(right.points.slice(1));
    const snapped = left.snapped.concat(right.snapped.slice(1));
    return { points, snapped, legs: left.legs.concat(right.legs) };
  }
  throw new Error(last);
}

function matchAnchors(points, snapped) {
  const anchors = [];
  let cursor = 0;
  for (const waypoint of snapped) {
    let best = cursor;
    let bestD = Infinity;
    for (let i = cursor; i < points.length; i += 1) {
      const d = dist2(points[i], waypoint);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    anchors.push(best);
    cursor = best;
  }
  return anchors;
}

function indexAtFraction(points, start, end, fraction) {
  if (end <= start) return start;
  const lengths = [];
  let total = 0;
  for (let i = start + 1; i <= end; i += 1) {
    const d = Math.sqrt(dist2(points[i - 1], points[i]));
    lengths.push(d);
    total += d;
  }
  if (total === 0) return start;
  let remain = total * Math.min(1, Math.max(0, fraction));
  for (let i = 0; i < lengths.length; i += 1) {
    if (remain <= lengths[i]) {
      const t = lengths[i] === 0 ? 0 : remain / lengths[i];
      return start + i + (t >= 0.5 ? 1 : 0);
    }
    remain -= lengths[i];
  }
  return end;
}

function groupsOf(direction) {
  const groups = [];
  direction.stops.forEach((stop, index) => {
    const named = stops.get(stop.stopId);
    const coord = [named.lat, named.lng];
    const last = groups[groups.length - 1];
    if (last && sameCoord(last.coord, coord)) {
      last.indexes.push(index);
      last.kms.push(stop.km);
    } else {
      groups.push({ coord, indexes: [index], kms: [stop.km] });
    }
  });
  return groups;
}

function repairDetours(points, waypointAnchors, groups, legs) {
  if (!legs?.length || waypointAnchors.length < 2) return { points, waypointAnchors };
  const out = [points[waypointAnchors[0]]];
  const anchors = [0];
  for (let index = 1; index < waypointAnchors.length; index += 1) {
    const previousKm = groups[index - 1].kms[groups[index - 1].kms.length - 1];
    const km = Math.max(0.2, groups[index].kms[0] - previousKm);
    const roadKm = legs[index - 1] ?? km;
    const detour = roadKm - km > 3 && roadKm > km * 2.2 + 1.5;
    const start = waypointAnchors[index - 1];
    const end = waypointAnchors[index];
    if (detour || end < start) {
      out.push(points[end]);
    } else {
      for (const point of points.slice(start + 1, end + 1)) out.push(point);
    }
    anchors.push(out.length - 1);
  }
  return { points: out, waypointAnchors: anchors };
}

function placeAnchors(direction, points, waypointAnchors, groups) {
  const anchors = new Array(direction.stops.length).fill(0);
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    const here = waypointAnchors[groupIndex];
    if (group.indexes.length === 1) {
      anchors[group.indexes[0]] = here;
      continue;
    }
    const prev = groupIndex > 0 ? groupIndex - 1 : null;
    const next = groupIndex < groups.length - 1 ? groupIndex + 1 : null;
    let startIdx = here;
    let endIdx = here;
    let startKm = group.kms[0];
    let endKm = group.kms[group.kms.length - 1];
    if (prev != null && next != null) {
      startIdx = waypointAnchors[prev];
      endIdx = waypointAnchors[next];
      startKm = groups[prev].kms[groups[prev].kms.length - 1];
      endKm = groups[next].kms[0];
    } else if (next != null) {
      startIdx = here;
      endIdx = waypointAnchors[next];
      startKm = group.kms[0];
      endKm = groups[next].kms[0];
    } else if (prev != null) {
      startIdx = waypointAnchors[prev];
      endIdx = here;
      startKm = groups[prev].kms[groups[prev].kms.length - 1];
      endKm = group.kms[group.kms.length - 1];
    }
    if (!(endKm > startKm) || endIdx < startIdx) {
      for (const index of group.indexes) anchors[index] = here;
      continue;
    }
    for (let k = 0; k < group.indexes.length; k += 1) {
      const fraction = (group.kms[k] - startKm) / (endKm - startKm);
      anchors[group.indexes[k]] = indexAtFraction(points, startIdx, endIdx, fraction);
    }
  }
  for (let i = 1; i < anchors.length; i += 1) {
    if (anchors[i] < anchors[i - 1]) anchors[i] = anchors[i - 1];
  }
  return anchors;
}

function simplify(points, anchors) {
  const keep = new Set(anchors);
  const map = new Map([[0, 0]]);
  const out = [points[0]];
  let last = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (i !== points.length - 1 && !keep.has(i)) continue;
    const slice = points.slice(last, i + 1);
    const simple = slice.length <= 2 ? slice : douglas(slice, 0.00008);
    for (let k = 1; k < simple.length; k += 1) out.push(simple[k]);
    map.set(i, out.length - 1);
    last = i;
  }
  return {
    points: out,
    anchors: anchors.map((anchor) => map.get(anchor) ?? 0),
  };
}

function straight(direction) {
  const points = direction.stops.map((stop) => {
    const named = stops.get(stop.stopId);
    return roundPoint(named.lat, named.lng);
  });
  return { points, anchors: points.map((_, index) => index) };
}

const directions = network.lines.flatMap((line) => line.directions.map((direction) => ({ line: line.code, direction })));
let done = 0;
for (const item of directions) {
  done += 1;
  if (existing[item.direction.id]?.points?.length > 1) {
    console.log(`${done}/${directions.length} ${item.line} ${item.direction.id} cached`);
    continue;
  }
  const groups = groupsOf(item.direction);
  try {
    const routed = await routeCoords(groups.map((group) => group.coord));
    const matched = matchAnchors(routed.points, routed.snapped);
    const repaired = repairDetours(routed.points, matched, groups, routed.legs);
    const anchors = placeAnchors(item.direction, repaired.points, repaired.waypointAnchors, groups);
    existing[item.direction.id] = simplify(repaired.points, anchors);
    console.log(`${done}/${directions.length} ${item.line} ${item.direction.id} points ${existing[item.direction.id].points.length}`);
  } catch (error) {
    existing[item.direction.id] = straight(item.direction);
    console.log(`${done}/${directions.length} ${item.line} ${item.direction.id} FALLBACK ${error instanceof Error ? error.message : error}`);
  }
  fs.writeFileSync(partialPath, JSON.stringify(existing));
  await new Promise((resolve) => setTimeout(resolve, 180));
}

fs.writeFileSync(outPath, JSON.stringify(existing));
fs.rmSync(partialPath, { force: true });
console.log("wrote", outPath, "directions", Object.keys(existing).length);
