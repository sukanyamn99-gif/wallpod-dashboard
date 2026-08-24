import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No page in this app is meant to be framed by another site —
          // blocks clickjacking (tricking a logged-in user into clicking
          // through an invisible iframe of this dashboard).
          { key: "X-Frame-Options", value: "DENY" },
          // Stops the browser from guessing a response's content type
          // (e.g. treating an uploaded file as executable script).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak this app's internal URLs (job numbers, ids) to
          // third-party sites via the Referer header on outbound links.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
