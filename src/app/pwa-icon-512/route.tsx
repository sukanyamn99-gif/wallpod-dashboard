import { ImageResponse } from "next/og";

// See pwa-icon-192/route.tsx for why this is a plain Route Handler rather
// than the icon.tsx convention.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4C7EF3",
          color: "#fff",
          fontSize: 308,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        W
      </div>
    ),
    { width: 512, height: 512 },
  );
}
