import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

// Self-hosted by Next.js at build time (no runtime fetch to
// fonts.googleapis.com needed) — the app's own font-family stack
// (globals.css --font-sans) otherwise lists only OS-provided fonts
// ("Segoe UI", "Leelawadee UI", "Noto Sans Thai" itself as a system font),
// none of which exist in the minimal Linux Chromium used to render every
// print view's PDF download (@sparticuz/chromium on Vercel — see
// src/lib/pdf/get-browser.ts). Without a real loaded font there, every
// Thai character — which is virtually all text in every document this app
// prints — fell back to Chromium's font-less default and rendered
// blank/missing, making every PDF download look incomplete.
const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WALLPOD Owner Dashboard",
  description: "คูนเว จำกัด — ระบบติดตามยอดขายและสุขภาพบริษัท",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`dark h-full antialiased ${notoSansThai.variable}`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
