import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrowser } from "@/lib/pdf/get-browser";

// Matches the root layout's static <title> (src/app/layout.tsx) — the
// value every dashboard page starts with before a print view's own
// useEffect overwrites it with the real doc number.
const DEFAULT_TITLE = "WALLPOD Owner Dashboard";

// One generic route backs every "ดาวน์โหลด PDF" button in the app — each
// print view's own button just passes its own current pathname, so adding
// the button to a new print page never needs a new route. Puppeteer
// re-navigates to that same page (forwarding the caller's auth cookies so
// it renders with the same session/RLS access) and prints it with
// `@media print` active, reusing every print-specific CSS rule already
// tuned in each view (page breaks, hidden buttons, etc.) instead of
// re-implementing layout in a second code path.
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  // Only ever allow an internal /dashboard/... page — this parameter drives
  // what URL our own server navigates to, so it must never accept an
  // absolute URL or a path outside this app (open-redirect/SSRF risk).
  if (!path || !path.startsWith("/dashboard/") || path.includes("://")) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const targetUrl = new URL(path, request.nextUrl.origin);
  const cookieHeader = request.headers.get("cookie") ?? "";

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ cookie: cookieHeader });
    }
    await page.goto(targetUrl.toString(), { waitUntil: "networkidle0", timeout: 30000 });
    // Every print view sets its own document.title in a useEffect (the doc
    // number/report label) — that runs after React hydrates, later than
    // networkidle0, so read it once it actually changes from the app's
    // static default instead of racing it. A page that never changes its
    // title (there shouldn't be any) just falls through to the fallback
    // name below once this times out.
    await page
      .waitForFunction(
        (defaultTitle) => document.title !== defaultTitle && document.title !== "",
        { timeout: 3000 },
        DEFAULT_TITLE,
      )
      .catch(() => {});
    await page.emulateMediaType("print");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      // Print views zero out their own padding under @media print
      // (print:p-0) so a physical printer's own hardware margin provides
      // the spacing instead — but a downloaded PDF has no such margin of
      // its own, so it needs one set explicitly here, with extra room up
      // top for the letterhead to breathe.
      margin: { top: "20mm", right: "15mm", bottom: "15mm", left: "15mm" },
    });
    const title = (await page.title()) || "document";
    // Page titles here are always plain Thai/English doc numbers set by
    // each print view — strip anything a filename can't hold, just in case.
    const filename = `${title.replace(/[\\/:*?"<>|]/g, "").trim() || "document"}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF generation failed:", error);
    return NextResponse.json({ error: "สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
