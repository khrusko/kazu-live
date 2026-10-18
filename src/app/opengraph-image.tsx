import { ImageResponse } from "next/og";

export const alt = "Kazu bus · vozni red Karlovačke županije | Sizel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(145deg, #0f6e56 0%, #0a4d3c 55%, #123047 100%)",
          color: "#f4efe4",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, opacity: 0.85, letterSpacing: 2 }}>SIZEL BUSEVI</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>Kazu bus</div>
          <div style={{ display: "flex", fontSize: 36, opacity: 0.92, maxWidth: 900 }}>
            Vozni red i linije Karlovačke županije
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, opacity: 0.8 }}>busevi.sizel.eu · neslužbeni raspored</div>
      </div>
    ),
    { ...size },
  );
}
