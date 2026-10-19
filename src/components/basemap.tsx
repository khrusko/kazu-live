"use client";

import { TileLayer } from "react-leaflet";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export function Basemap({ satellite }: { satellite: boolean }) {
  if (satellite) {
    return (
      <TileLayer
        key="satellite"
        url={SATELLITE}
        maxZoom={19}
        attribution='Satelit &copy; <a href="https://www.esri.com/">Esri</a>'
      />
    );
  }
  return (
    <TileLayer
      key="osm"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url={OSM}
      maxZoom={19}
    />
  );
}

export function BasemapSwitch({
  satellite,
  onChange,
  className = "absolute top-2 right-2 z-[500]",
}: {
  satellite: boolean;
  onChange: (satellite: boolean) => void;
  className?: string;
}) {
  return (
    <div className={`${className} flex overflow-hidden rounded-full bg-white text-xs font-medium shadow ring-1 ring-black/10`}>
      <button
        type="button"
        className={`px-3 py-1.5 ${satellite ? "text-foreground" : "bg-[oklch(0.34_0.06_168)] text-white"}`}
        onClick={() => onChange(false)}
      >
        Karta
      </button>
      <button
        type="button"
        className={`px-3 py-1.5 ${satellite ? "bg-[oklch(0.34_0.06_168)] text-white" : "text-foreground"}`}
        onClick={() => onChange(true)}
      >
        Satelit
      </button>
    </div>
  );
}
