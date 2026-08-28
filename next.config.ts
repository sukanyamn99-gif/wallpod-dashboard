import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React's dev-only double-render/double-effect cycle (on by default) was
  // tripping a false-positive "changing default value after being
  // initialized" warning in @base-ui/react's Select/FieldControl on every
  // page that has one — even on a first, totally-fresh mount with no real
  // prop change involved. Confirmed dev-only (this diagnostic behavior does
  // not run in production builds), so turning it off here only quiets that
  // noisy Next.js dev error overlay; it doesn't change any real behavior.
  reactStrictMode: false,
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
