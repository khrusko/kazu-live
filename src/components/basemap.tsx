"use client";

import { TileLayer, WMSTileLayer } from "react-leaflet";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ORTHOPHOTO = "https://geoportal.dgu.hr/services/inspire/orthophoto_2024/wms";

export function Basemap({ satellite }: { satellite: boolean }) {
  if (satellite) {
    return (
      <WMSTileLayer
        key="dof"
        url={ORTHOPHOTO}
        layers="OI.OrthoimageCoverage"
        styles="OI.OrthoimageCoverage.Default"
        format="image/jpeg"
        version="1.3.0"
        transparent={false}
        uppercase
        maxZoom={19}
        updateWhenIdle={false}
        attribution='Ortofoto &copy; <a href="https://geoportal.dgu.hr/">DGU Geoportal</a>'
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
