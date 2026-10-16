"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function Fit({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) return;
    map.fitBounds(positions, { padding: [28, 28] });
    // New map instance mounts when the itinerary changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

export function RouteMap({
  parts,
  pins,
}: {
  parts: { color: string; positions: [number, number][] }[];
  pins: { lat: number; lng: number; label: string }[];
}) {
  const positions = parts.flatMap((part) => part.positions);
  const center = positions[0] ?? [45.49, 15.55];
  const signature = `${pins.map((pin) => pin.label).join("|")}:${positions.length}`;
  return (
    <div className="h-56 w-full sm:h-72">
      <MapContainer key={signature} center={center} zoom={11} className="h-full w-full" scrollWheelZoom={false} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {parts.map((part, index) => (
          <Polyline key={index} positions={part.positions} pathOptions={{ color: part.color, weight: 5, opacity: 0.9 }} />
        ))}
        {pins.map((pin) => (
          <CircleMarker
            key={pin.label}
            center={[pin.lat, pin.lng]}
            radius={7}
            pathOptions={{ color: "#1c1915", weight: 2, fillColor: "#f4e3b2", fillOpacity: 1 }}
          >
            <Tooltip>{pin.label}</Tooltip>
          </CircleMarker>
        ))}
        <Fit positions={positions} />
      </MapContainer>
    </div>
  );
}
