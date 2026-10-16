import type { Stop } from "./types";

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatMeters(meters: number) {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  const km = meters / 1000;
  const digits = km < 10 ? 1 : 0;
  return `${km.toFixed(digits).replace(".", ",")} km`;
}

export function fold(value: string) {
  return value
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function placeScore(name: string) {
  const folded = fold(name);
  if (folded.includes("centar")) return 0;
  if (folded.startsWith("ak ") || folded.includes("kolodvor") || folded.includes("terminal")) return 1;
  if (/\b(i|ii|iii|iv|v)\b/.test(folded)) return 3;
  return 2;
}

export function pickNearest(stops: Stop[], lat: number, lng: number) {
  if (!stops.length) return null;
  const here = { lat, lng };
  const ranked = stops
    .map((stop) => ({ stop, meters: distanceMeters(stop, here) }))
    .sort((a, b) => a.meters - b.meters);
  const nearest = ranked[0].meters;
  const cluster = ranked
    .filter((item) => item.meters <= nearest + 50)
    .sort((a, b) => placeScore(a.stop.name) - placeScore(b.stop.name) || a.meters - b.meters);
  const chosen = cluster[0];
  const nearby = ranked.filter((item) => item.stop.id !== chosen.stop.id && item.meters < 800).slice(0, 5);
  return { stop: chosen.stop, meters: chosen.meters, nearby };
}
