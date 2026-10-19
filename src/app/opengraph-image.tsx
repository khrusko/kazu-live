import { ImageResponse } from "next/og";

export const alt = "Sizel, vozni red Karlovačke županije";
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
          background: "linear-gradient(145deg, #123f36 0%, #1d6a57 58%, #2f8f72 100%)",
          color: "white",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: 56,
              background: "white",
              color: "#145246",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 32 }}>
            <div style={{ fontSize: 26, letterSpacing: 3, opacity: 0.85 }}>KARLOVAČKA ŽUPANIJA</div>
            <div style={{ fontSize: 92, lineHeight: 1, marginTop: 8 }}>Sizel</div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 42 }}>Vozni red i linije</div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: "#f4e3b2" }} />
          <div style={{ width: 220, height: 4, background: "rgba(255,255,255,0.75)", marginLeft: 12 }} />
          <div style={{ width: 18, height: 18, borderRadius: 9, background: "white", marginLeft: 12 }} />
          <div style={{ marginLeft: 28, fontSize: 26, opacity: 0.85 }}>busevi.sizel.eu</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
