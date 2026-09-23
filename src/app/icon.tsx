import { ImageResponse } from "next/og";

// Browser-tab favicon — reuses the same mark as apple-icon.tsx and the two
// fixed-size PWA install icons below, just at the small size browsers
// actually request for a tab.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 22,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        W
      </div>
    ),
    { ...size },
  );
}
