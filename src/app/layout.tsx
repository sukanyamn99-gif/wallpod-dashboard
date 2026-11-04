import type { Metadata, Viewport } from "next";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "./globals.css";

// Bundled from the @fontsource npm package, so the build never has to reach
// fonts.googleapis.com (a failed fetch there broke deployments). The app's
// own font-family stack (globals.css --font-sans) otherwise lists only
// OS-provided fonts ("Segoe UI", "Leelawadee UI", "Noto Sans Thai" itself as
// a system font), none of which exist in the minimal Linux Chromium used to
// render every print view's PDF download (@sparticuz/chromium on Vercel —
// see src/lib/pdf/get-browser.ts). Without a real loaded font there, every
// Thai character — which is virtually all text in every document this app
// prints — fell back to Chromium's font-less default and rendered
// blank/missing, making every PDF download look incomplete.

export const metadata: Metadata = {
  title: "Koonway Dashboard",
  description: "คูนเว จำกัด — ระบบติดตามยอดขายและสุขภาพบริษัท",
  // Lets Chrome/Edge offer "Install app", which puts a desktop/taskbar icon
  // that opens the dashboard in its own window instead of a browser tab —
  // see manifest.ts and the icon.tsx/apple-icon.tsx/pwa-icon-* files.
  manifest: "/manifest.webmanifest",
  appleWebApp: { title: "Koonway", statusBarStyle: "black-translucent" },
};

// Matches manifest.ts's background/theme color — colors the installed
// window's title bar and, on mobile, the browser's address bar.
export const viewport: Viewport = {
  themeColor: "#0E1320",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className="dark h-full antialiased"
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
