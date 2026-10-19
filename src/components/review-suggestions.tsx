"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CircleMarker, MapContainer, Polyline, useMap } from "react-leaflet";
import { toast } from "sonner";
import { Basemap } from "@/components/basemap";
import { useKazu } from "@/components/providers";
import "leaflet/dist/leaflet.css";

type Item = {
  id: string;
  stopId: string;
  stopName: string;
  lat: number;
  lng: number;
  note: string;
  createdAt: string;
  byName: string | null;
  currentLat: number | null;
  currentLng: number | null;
};

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((point) => point.join(",")).join(";");
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [28, 28], maxZoom: 16 });
    // Fit when the selected suggestion changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export function ReviewSuggestions() {
  const { user, loading, refresh } = useKazu();
  const [items, setItems] = useState<Item[]>([]);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/suggestions", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Prijedlozi nisu učitani.");
    const suggestions = data.suggestions as Item[];
    setItems(suggestions);
    setCurrent((id) => (id && suggestions.some((item) => item.id === id) ? id : suggestions[0]?.id ?? null));
  }, []);

  useEffect(() => {
    if (loading || !user || user.role !== "admin") return;
    load()
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setReady(true));
  }, [loading, user, load]);

  if (loading || (user?.role === "admin" && !ready)) return <p className="p-8 text-sm">Učitavam…</p>;
  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl">Prijedlozi lokacija</h1>
        <p className="mt-2 text-sm">Ovo može samo administrator.</p>
        <Link href="/prijava?next=/admin/prijedlozi" className="mt-3 inline-block text-sm text-primary">
          Prijava
        </Link>
      </div>
    );
  }

  const selected = items.find((item) => item.id === current) ?? null;
  const here: [number, number] | null =
    selected && selected.currentLat != null && selected.currentLng != null ? [selected.currentLat, selected.currentLng] : null;
  const proposal: [number, number] | null = selected ? [selected.lat, selected.lng] : null;

  async function decide(action: "prihvati" | "odbij") {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/suggestions/${selected.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nije spremljeno.");
      toast.success(action === "prihvati" ? "Lokacija je prihvaćena." : "Prijedlog je odbijen.");
      if (action === "prihvati") await refresh();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nije spremljeno.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <Link href="/admin" className="text-xs text-muted-foreground">
        Administrator
      </Link>
      <h1 className="font-display text-3xl">Prijedlozi lokacija</h1>
      <p className="mt-1 text-sm text-muted-foreground">Siva oznaka je trenutno mjesto, zelena je prijedlog.</p>
      {items.length === 0 ? (
        <p className="mt-6 text-sm">Nema prijedloga na čekanju.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
          <ul className="max-h-[70vh] space-y-2 overflow-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm ring-1 ring-foreground/10 ${item.id === selected?.id ? "bg-muted" : "bg-card"}`}
                  onClick={() => setCurrent(item.id)}
                >
                  <span className="block font-medium">{item.stopName}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.byName ? item.byName : "Bez prijave"} · {new Date(item.createdAt).toLocaleString("hr-HR")}
                  </span>
                  {item.note && <span className="mt-1 block text-xs">{item.note}</span>}
                </button>
              </li>
            ))}
          </ul>
          <div>
            <div className="h-80 overflow-hidden rounded-2xl ring-1 ring-foreground/10">
              {proposal && (
                <MapContainer center={proposal} zoom={15} className="h-full w-full" scrollWheelZoom fadeAnimation={false}>
                  <Basemap satellite={false} />
                  <Fit points={[...(here ? [here] : []), proposal]} />
                  {here && <CircleMarker center={here} radius={8} pathOptions={{ color: "#64748b", fillColor: "#64748b", fillOpacity: 0.85 }} />}
                  <CircleMarker center={proposal} radius={9} pathOptions={{ color: "#0f766e", fillColor: "#0f766e", fillOpacity: 0.95 }} />
                  {here && <Polyline positions={[here, proposal]} pathOptions={{ color: "#0f766e", dashArray: "5 6", weight: 3 }} />}
                </MapContainer>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground" disabled={busy} onClick={() => decide("prihvati")}>
                Prihvati
              </button>
              <button type="button" className="rounded-full bg-muted px-4 py-2 text-sm" disabled={busy} onClick={() => decide("odbij")}>
                Odbij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
