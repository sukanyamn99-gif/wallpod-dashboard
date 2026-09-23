import { ImageResponse } from "next/og";

// A plain Route Handler, not the special icon.tsx convention — the PWA
// manifest needs a fixed, predictable URL per size to list in its `icons`
// array, whereas icon.tsx's generated URLs carry an unpredictable cache
// hash. Same mark as icon.tsx/apple-icon.tsx, scaled up for the install
// prompt and desktop shortcut icon.
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
          fontSize: 116,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        W
      </div>
    ),
    { width: 192, height: 192 },
  );
}
