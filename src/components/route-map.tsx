"use client";

import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Tooltip, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import { Basemap, BasemapSwitch } from "@/components/basemap";
import "leaflet/dist/leaflet.css";

export type RouteDraw = {
  parts: { color: string; code?: string; positions: [number, number][] }[];
  pins: { lat: number; lng: number; label: string }[];
};

function lineTag(code: string, color: string, current: boolean) {
  const text = current ? `${code} · Trenutna ruta` : code;
  const width = current ? 154 : 44;
  return L.divIcon({
    className: "bus-pin",
    html: `<span style="background:${color}">${text}</span>`,
    iconSize: [width, 22],
    iconAnchor: [width / 2, 11],
  });
}

function numberTag(number: number, current: boolean) {
  return L.divIcon({
    className: "bus-pin",
    html: `<span style="background:${current ? "#1c1915" : "#d5dbd6"};color:${current ? "#fff" : "#3c463f"}">${number}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function lineTags(
  routes: RouteDraw[],
  active: number,
  colorFor: (index: number, partColor: string) => string,
) {
  const tags = new Map<string, { code: string; color: string; position: [number, number]; active: boolean }>();
  routes.forEach((route, index) => {
    route.parts.forEach((part) => {
      if (!part.code || part.positions.length === 0) return;
      const position = part.positions[Math.floor(part.positions.length / 2)];
      const previous = tags.get(part.code);
      const chosen = index === active;
      if (previous && !(chosen && !previous.active)) return;
      tags.set(part.code, { code: part.code, color: chosen ? colorFor(index, part.color) : "#8b948e", position, active: chosen });
    });
  });
  return [...tags.values()];
}

function Fit({ positions, signature }: { positions: [number, number][]; signature: string }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) return;
    const apply = () => {
      map.invalidateSize();
      map.fitBounds(positions, { padding: [36, 36] });
    };
    apply();
    const timer = window.setTimeout(apply, 250);
    return () => window.clearTimeout(timer);
    // Refit when the journey changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);
  return null;
}

export function RouteMap({
  routes,
  active,
  onSelect,
  className,
  scrollWheel = false,
}: {
  routes: RouteDraw[];
  active: number;
  onSelect?: (index: number) => void;
  className?: string;
  scrollWheel?: boolean;
}) {
  const [satellite, setSatellite] = useState(false);
  const positions = routes.flatMap((route) => route.parts.flatMap((part) => part.positions));
  const center = positions[0] ?? [45.49, 15.55];
  const signature = routes
    .map((route) => route.parts.map((part) => `${part.code ?? ""}:${part.positions.length}:${part.positions[0]?.join(",") ?? ""}`).join("|"))
    .join(";");
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
    <div className={className ? `relative h-full w-full ${className}` : "relative h-56 w-full sm:h-72"}>
      <MapContainer center={center} zoom={11} className="h-full w-full" scrollWheelZoom={scrollWheel} zoomControl={false} fadeAnimation={false}>
        <Basemap satellite={satellite} />
        <ZoomControl position="bottomright" />
        {order.map((index) => {
          const route = routes[index];
          const chosen = index === active;
          return route.parts.flatMap((part, partIndex) => {
            const select = onSelect ? { click: () => onSelect(index) } : undefined;
            const line = (
              <Polyline
                key={`${index}-${partIndex}`}
                positions={part.positions}
                pathOptions={{
                  color: chosen ? colorFor(index, part.color) : "#9aa39c",
                  weight: chosen ? 6 : 4,
                  opacity: chosen ? 1 : 0.55,
                }}
                eventHandlers={select}
              />
            );
            if (!chosen) return [line];
            return [
              <Polyline
                key={`${index}-${partIndex}-halo`}
                positions={part.positions}
                pathOptions={{ color: "#ffffff", weight: 10, opacity: 0.95 }}
                eventHandlers={select}
              />,
              line,
            ];
          });
        })}
        {routes.map((route, index) => {
          const positions = route.parts.flatMap((part) => part.positions);
          if (positions.length < 2) return null;
          const at = positions[Math.min(positions.length - 1, Math.floor(positions.length * 0.62))];
          return (
            <Marker
              key={`n-${index}`}
              position={at}
              icon={numberTag(index + 1, index === active)}
              zIndexOffset={index === active ? 650 : 280}
              eventHandlers={onSelect ? { click: () => onSelect(index) } : undefined}
            />
          );
        })}
        {lineTags(routes, active, colorFor).map((tag) => (
          <Marker
            key={`tag-${tag.code}`}
            position={tag.position}
            icon={lineTag(tag.code, tag.color, tag.active)}
            interactive={false}
            zIndexOffset={tag.active ? 600 : 240}
          />
        ))}
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
      <BasemapSwitch satellite={satellite} onChange={setSatellite} />
    </div>
  );
}
