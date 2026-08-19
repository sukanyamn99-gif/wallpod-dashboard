import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="th" className="dark h-full antialiased" style={{ colorScheme: "dark" }}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
