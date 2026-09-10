import type { Browser } from "puppeteer-core";

// Puppeteer needs two different Chromium builds depending on where this
// runs: locally on this Windows dev machine, the full `puppeteer` package
// (a devDependency) already downloaded a matching Chrome binary for the
// OS it's running on; on Vercel's Linux serverless functions, that binary
// doesn't exist, so production uses `@sparticuz/chromium`'s bundled Linux
// build instead via `puppeteer-core`. Both are dynamic imports so the
// unused one in each environment never needs to actually resolve.
export async function getBrowser(): Promise<Browser> {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const puppeteer = (await import("puppeteer")).default;
  // puppeteer's own Browser type is structurally identical to
  // puppeteer-core's for everything this module uses (newPage/close) — cast
  // instead of importing both packages' types into one union everywhere.
  return puppeteer.launch({ headless: true }) as unknown as Promise<Browser>;
}
