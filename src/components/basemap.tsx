"use client";

import { useEffect } from "react";
import { TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import proj4 from "proj4";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ORTHOPHOTO = "https://geoportal.dgu.hr/wms";

proj4.defs(
  "EPSG:3765",
  "+proj=tmerc +lat_0=0 +lon_0=16.5 +k=0.9999 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
);

function to3765(lng: number, lat: number) {
  const [x, y] = proj4("EPSG:4326", "EPSG:3765", [lng, lat]);
  return [x, y] as const;
}

const GeoportalOrtho = L.TileLayer.extend({
  getTileUrl(coords: L.Coords) {
    const map = this._map as L.Map;
    const size = this.getTileSize();
    const northWest = coords.scaleBy(size);
    const southEast = northWest.add(L.point(size.x, size.y));
    const start = map.unproject(northWest, coords.z);
    const end = map.unproject(southEast, coords.z);
    const [ax, ay] = to3765(start.lng, start.lat);
    const [bx, by] = to3765(end.lng, end.lat);
    const bbox = [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)].join(",");
    const query = [
      "SERVICE=WMS",
      "VERSION=1.3.0",
      "REQUEST=GetMap",
      "LAYERS=DOF",
      "STYLES=",
      "FORMAT=image/jpeg",
      "TRANSPARENT=FALSE",
      "CRS=EPSG:3765",
      `WIDTH=${size.x}`,
      `HEIGHT=${size.y}`,
      `BBOX=${bbox}`,
    ].join("&");
    return `${ORTHOPHOTO}?${query}`;
  },
});

function GeoportalLayer() {
  const map = useMap();
  useEffect(() => {
    const Ortho = GeoportalOrtho as new (options?: L.TileLayerOptions) => L.TileLayer;
    const layer = new Ortho({
      maxZoom: 19,
      maxNativeZoom: 18,
      updateWhenIdle: false,
      attribution: 'Ortofoto &copy; <a href="https://geoportal.dgu.hr/">DGU Geoportal</a>',
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map]);
  return null;
}

export function Basemap({ satellite }: { satellite: boolean }) {
  if (satellite) return <GeoportalLayer />;
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
