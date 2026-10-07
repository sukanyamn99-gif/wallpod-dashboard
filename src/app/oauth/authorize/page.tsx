import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/data/profile";
import {
  CODE_CHALLENGE_PATTERN,
  canAuthorizeMcp,
  MCP_SCOPE,
  REQUEST_TTL,
  getOauthSecret,
  isAllowedRedirectUri,
  signJwt,
  verifyJwt,
} from "@/lib/mcp/oauth";
import { diag } from "@/lib/mcp/diag";
import { decideAuthorization } from "./actions";

export const dynamic = "force-dynamic";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Koonway OS — เชื่อมต่อกับ ChatGPT</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  if (!getOauthSecret()) {
    return (
      <Shell title="ยังไม่เปิดใช้งาน">
        <p className="text-sm">ระบบเชื่อมต่อ ChatGPT ยังไม่ได้ตั้งค่า (MCP_OAUTH_SECRET)</p>
      </Shell>
    );
  }

  const clientId = first(sp.client_id) ?? "";
  const redirectUri = first(sp.redirect_uri) ?? "";
  const codeChallenge = first(sp.code_challenge) ?? "";
  const client = verifyJwt(clientId, "client");
  const registeredUris = Array.isArray(client?.redirect_uris) ? (client.redirect_uris as string[]) : [];

  // Never redirect to (or even render approval for) a request that fails any
  // of these checks — a bad redirect_uri must not become an open redirect.
  const problem =
    !client
      ? "client_id ไม่ถูกต้องหรือหมดอายุ"
      : first(sp.response_type) !== "code"
        ? "รองรับเฉพาะ response_type=code"
        : !registeredUris.includes(redirectUri) || !isAllowedRedirectUri(redirectUri)
          ? "redirect_uri ไม่ตรงกับที่ลงทะเบียนไว้"
          : first(sp.code_challenge_method) !== "S256" || !CODE_CHALLENGE_PATTERN.test(codeChallenge)
            ? "ต้องใช้ PKCE แบบ S256"
            : null;

  // Non-secret request metadata only (never the client_id token or PKCE
  // challenge) — lets us see in Runtime Logs whether ChatGPT reached this
  // page and whether its redirect_uri was accepted.
  diag("authorize.page", null, {
    problem,
    redirectUri,
    responseType: first(sp.response_type),
    codeChallengeMethod: first(sp.code_challenge_method),
    hasState: !!first(sp.state),
  });

  if (problem || !client) {
    return (
      <Shell title="คำขอเชื่อมต่อไม่ถูกต้อง">
        <p className="text-sm text-destructive">{problem}</p>
      </Shell>
    );
  }

  const profile = await getCurrentProfile();
  if (!profile || !profile.active) {
    return (
      <Shell title="กรุณาเข้าสู่ระบบ">
        <p className="text-sm">ต้องเข้าสู่ระบบ Koonway OS ก่อนอนุมัติการเชื่อมต่อ</p>
      </Shell>
    );
  }
  if (!canAuthorizeMcp(profile.role)) {
    return (
      <Shell title="ไม่มีสิทธิ์">
        <p className="text-sm">เฉพาะเจ้าของกิจการ/ผู้จัดการเท่านั้นที่เชื่อมต่อ ChatGPT กับข้อมูลบริษัทได้</p>
      </Shell>
    );
  }

  const reqToken = signJwt(
    "authreq",
    {
      cid: clientId,
      ru: redirectUri,
      cc: codeChallenge,
      state: first(sp.state) ?? "",
      scope: MCP_SCOPE,
      uid: profile.id,
    },
    REQUEST_TTL,
  );
  const clientName = String(client.client_name ?? "MCP client");
  const redirectHost = new URL(redirectUri).host;

  return (
    <Shell title="อนุญาตให้เชื่อมต่อข้อมูลบริษัท?">
      <p className="text-sm">
        <span className="font-medium">{clientName}</span> ({redirectHost}) ขออนุญาตอ่านข้อมูลของ Koonway ในนามของ{" "}
        <span className="font-medium">{profile.full_name}</span>
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>อ่านได้อย่างเดียว: ยอดขาย งาน กำไร/ต้นทุน ลูกหนี้ สต๊อก กิจกรรมการขาย</li>
        <li>ไม่สามารถเพิ่ม แก้ไข หรือลบข้อมูลใดๆ ได้</li>
        <li>ไม่เห็นเลขภาษี เบอร์โทร ที่อยู่ลูกค้า เงินเดือน และอีเมลผู้ใช้</li>
      </ul>
      <p className="text-xs text-muted-foreground">
        ข้อมูลที่ถูกอ่านจะถูกส่งไปยังผู้ให้บริการ AI ที่คุณเชื่อมต่อ อนุญาตเฉพาะเมื่อคุณเป็นผู้เริ่มการเชื่อมต่อนี้เอง
      </p>
      <form action={decideAuthorization} className="flex gap-2">
        <input type="hidden" name="req" value={reqToken} />
        <Button type="submit" name="decision" value="allow" className="flex-1">
          อนุญาต
        </Button>
        <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">
          ไม่อนุญาต
        </Button>
      </form>
    </Shell>
  );
}
