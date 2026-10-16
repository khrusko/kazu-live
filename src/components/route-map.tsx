"use client";

import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export type RouteDraw = {
  parts: { color: string; positions: [number, number][] }[];
  pins: { lat: number; lng: number; label: string }[];
};

function Fit({ positions, signature }: { positions: [number, number][]; signature: string }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) return;
    map.fitBounds(positions, { padding: [32, 32] });
    // Refit when the journey changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);
  return null;
}

export function RouteMap({
  routes,
  active,
  onSelect,
}: {
  routes: RouteDraw[];
  active: number;
  onSelect?: (index: number) => void;
}) {
  const [satellite, setSatellite] = useState(false);
  const positions = routes.flatMap((route) => route.parts.flatMap((part) => part.positions));
  const center = positions[0] ?? [45.49, 15.55];
  const signature = routes.map((route) => route.parts.reduce((sum, part) => sum + part.positions.length, 0)).join(":");
  const palette = ["#2563eb", "#e11d48", "#0f766e", "#d97706"];
  const order = routes.map((_, index) => index).sort((a, b) => Number(a === active) - Number(b === active));
  function colorFor(index: number, partColor: string) {
    const own = new Set(routes[index]?.parts.map((part) => part.color) ?? []);
    const clashes = [...own].some((color) =>
      routes.some((route, other) => other !== index && route.parts.some((part) => part.color === color)),
    );
    return clashes ? palette[index % palette.length] : partColor;
  }

  return (
    <div className="relative h-56 w-full sm:h-72">
      <MapContainer center={center} zoom={11} className="h-full w-full" scrollWheelZoom={false} zoomControl={false}>
        <TileLayer
          key={satellite ? "sat" : "osm"}
          attribution={
            satellite
              ? "Tiles &copy; Esri"
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }
          url={satellite ? SATELLITE : OSM}
          maxZoom={19}
        />
        <ZoomControl position="bottomright" />
        {order.map((index) => {
          const route = routes[index];
          const chosen = index === active;
          return route.parts.flatMap((part, partIndex) => {
            const select = onSelect ? { click: () => onSelect(index) } : undefined;
            return [
              <Polyline
                key={`${index}-${partIndex}-halo`}
                positions={part.positions}
                pathOptions={{ color: "#ffffff", weight: chosen ? 10 : 8, opacity: 0.95 }}
                eventHandlers={select}
              />,
              <Polyline
                key={`${index}-${partIndex}`}
                positions={part.positions}
                pathOptions={{ color: colorFor(index, part.color), weight: chosen ? 6 : 4, opacity: chosen ? 1 : 0.9 }}
                eventHandlers={select}
              />,
            ];
          });
        })}
        {routes[active]?.pins.map((pin) => (
          <CircleMarker
            key={`${pin.label}-${pin.lat}`}
            center={[pin.lat, pin.lng]}
            radius={7}
            pathOptions={{ color: "#1c1915", weight: 2, fillColor: "#f4e3b2", fillOpacity: 1 }}
          >
            <Tooltip>{pin.label}</Tooltip>
          </CircleMarker>
        ))}
        <Fit positions={positions} signature={signature} />
      </MapContainer>
      <div className="absolute top-2 right-2 z-[500] flex overflow-hidden rounded-full bg-white text-xs font-medium shadow ring-1 ring-black/10">
        <button
          type="button"
          className={`px-3 py-1.5 ${satellite ? "text-foreground" : "bg-[oklch(0.34_0.06_168)] text-white"}`}
          onClick={() => setSatellite(false)}
        >
          Karta
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 ${satellite ? "bg-[oklch(0.34_0.06_168)] text-white" : "text-foreground"}`}
          onClick={() => setSatellite(true)}
        >
          Satelit
        </button>
      </div>
    </div>
  );
}
