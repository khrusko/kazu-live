"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleMarker, MapContainer, useMap, useMapEvents } from "react-leaflet";
import { toast } from "sonner";
import { Basemap, BasemapSwitch } from "@/components/basemap";
import { useKazu } from "@/components/providers";
import { fold } from "@/lib/geo";
import "leaflet/dist/leaflet.css";

function Fly({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.45 });
  }, [lat, lng, map]);
  return null;
}

function Pick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export function SuggestStop() {
  const params = useSearchParams();
  const { network, loading, user } = useKazu();
  const [query, setQuery] = useState("");
  const [stopId, setStopId] = useState(params.get("stop") ?? "");
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [sent, setSent] = useState(false);

  const stops = network?.stops ?? [];
  const selected = stops.find((stop) => stop.id === stopId) ?? null;
  const hits = useMemo(() => {
    const text = fold(query.trim());
    if (text.length < 2) return [];
    return stops
      .filter((stop) => fold(stop.name).includes(text))
      .sort((a, b) => Number(fold(b.name).startsWith(text)) - Number(fold(a.name).startsWith(text)))
      .slice(0, 8);
  }, [query, stops]);

  if (loading) return <p className="p-8 text-sm">Učitavam…</p>;

  function choose(id: string) {
    const stop = stops.find((item) => item.id === id);
    setStopId(id);
    setQuery("");
    setSent(false);
    if (stop) setPoint([stop.lat, stop.lng]);
  }

  async function submit() {
    if (!selected || !point) {
      toast.error("Odaberi stajalište i klikni na karti gdje se nalazi.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stopId: selected.id, lat: point[0], lng: point[1], note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Prijedlog nije poslan.");
      setSent(true);
      setNote("");
      toast.success("Prijedlog je poslan. Dispečer će ga pregledati.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Prijedlog nije poslan.");
    } finally {
      setBusy(false);
    }
  }

  const proposal = point ?? (selected ? [selected.lat, selected.lng] : null);

  return (
    <div className="flex h-full min-h-[420px] flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b bg-background p-4 lg:w-[380px] lg:border-r lg:border-b-0">
        <h1 className="font-display text-3xl">Točna lokacija stajališta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ako stajalište na karti nije gdje autobus staje, klikni točno mjesto i pošalji. Može i bez prijave. Dispečer prijedlog prihvati ili odbije.
        </p>
        <label className="mt-4 block text-xs text-muted-foreground">
          Stajalište
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={selected?.name ?? "Upiši naziv, npr. Ozalj"}
            className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground"
          />
        </label>
        {hits.length > 0 && (
          <ul className="mt-1 max-h-40 overflow-auto rounded-lg bg-muted p-1">
            {hits.map((stop) => (
              <li key={stop.id}>
                <button type="button" className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-background" onClick={() => choose(stop.id)}>
                  {stop.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {selected && <p className="mt-3 text-sm">Odabrano: {selected.name}</p>}
        <label className="mt-3 block text-xs text-muted-foreground">
          Napomena, nije obavezna
          <textarea
            value={note}
            maxLength={240}
            onChange={(event) => setNote(event.target.value)}
            className="mt-1 h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="Npr. kod trgovine, ne kod škole"
          />
        </label>
        <button type="button" className="mt-3 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground" disabled={busy} onClick={submit}>
          {busy ? "Šaljem…" : "Pošalji prijedlog"}
        </button>
        {sent && <p className="mt-2 text-sm">Hvala. Prijedlog čeka pregled.</p>}
        {user?.role === "admin" && (
          <Link href="/admin/prijedlozi" className="mt-4 inline-block text-sm text-primary">
            Pregled prijedloga
          </Link>
        )}
      </aside>
      <div className="relative min-h-[320px] flex-1">
        <MapContainer center={[45.4, 15.55]} zoom={10} className="h-full w-full" scrollWheelZoom fadeAnimation={false}>
          <Basemap satellite={satellite} />
          <Pick
            onPick={(lat, lng) => {
              if (!selected) {
                toast.error("Prvo odaberi stajalište.");
                return;
              }
              setPoint([lat, lng]);
              setSent(false);
            }}
          />
          {selected && proposal && <Fly lat={proposal[0]} lng={proposal[1]} />}
          {selected && (
            <CircleMarker center={[selected.lat, selected.lng]} radius={7} pathOptions={{ color: "#64748b", fillColor: "#64748b", fillOpacity: 0.7 }} />
          )}
          {proposal && selected && (
            <CircleMarker center={proposal} radius={9} pathOptions={{ color: "#0f766e", fillColor: "#0f766e", fillOpacity: 0.95 }} />
          )}
        </MapContainer>
        <BasemapSwitch satellite={satellite} onChange={setSatellite} />
      </div>
    </div>
  );
}
