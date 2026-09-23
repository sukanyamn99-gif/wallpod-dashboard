import { ImageResponse } from "next/og";

// iOS/iPadOS "Add to Home Screen" and macOS Safari "Add to Dock" both read
// this — same mark as icon.tsx, at the larger size those surfaces expect.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 108,
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
