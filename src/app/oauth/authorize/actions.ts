"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { CODE_TTL, canAuthorizeMcp, signJwt, verifyJwt } from "@/lib/mcp/oauth";

// The consent form's submit. Everything that matters is read from the signed
// "authreq" token the page issued (not from form fields the browser could
// tamper with), and the person clicking must still be the same logged-in
// owner/manager the token was issued to.
export async function decideAuthorization(formData: FormData) {
  const req = verifyJwt(String(formData.get("req") ?? ""), "authreq");
  if (!req) {
    throw new Error("คำขอเชื่อมต่อหมดอายุ กรุณากลับไปกดเชื่อมต่อใหม่จาก ChatGPT");
  }

  const profile = await getCurrentProfile();
  if (!profile || !profile.active || !canAuthorizeMcp(profile.role) || profile.id !== req.uid) {
    throw new Error("ไม่มีสิทธิ์อนุมัติการเชื่อมต่อนี้");
  }

  const target = new URL(String(req.ru));
  if (req.state) target.searchParams.set("state", String(req.state));

  if (formData.get("decision") !== "allow") {
    target.searchParams.set("error", "access_denied");
    redirect(target.toString());
  }

  const code = signJwt(
    "code",
    { cid: req.cid, ru: req.ru, cc: req.cc, sub: profile.id, scope: req.scope },
    CODE_TTL,
  );
  target.searchParams.set("code", code);
  redirect(target.toString());
}
