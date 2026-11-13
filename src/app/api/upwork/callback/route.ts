import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requestOrigin } from "@/lib/server/origin";
import {
  issueSession,
  SESSION_COOKIE,
  verifySession,
} from "@/lib/server/session";
import { errorResponse } from "@/lib/server/errors";
import {
  OAUTH_COOKIE,
  UPWORK_COOKIE,
  exchangeCode,
  matchesState,
  seal,
  unseal,
} from "@/lib/server/upwork/connection";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const origin = requestOrigin(request).origin;
    const jar = await cookies();
    const pending = z
      .object({
        state: z.string(),
        returnTo: z.literal("/companion").optional(),
        redirectUri: z.string(),
        clientId: z.string(),
        verifier: z.string(),
        expiresAt: z.number(),
      })
      .safeParse(unseal(jar.get(OAUTH_COOKIE)?.value));
    jar.set(OAUTH_COOKIE, "", { path: "/api/upwork", maxAge: 0 });
    const params = new URL(request.url).searchParams;
    const state = params.get("state") || "";
    const fail = (reason = "failed") =>
      NextResponse.redirect(new URL(`/?connection=${reason}`, origin), {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    if (!pending.success || pending.data.expiresAt <= Date.now())
      return fail("expired");
    if (
      !pending.success ||
      pending.data.expiresAt <= Date.now() ||
      !matchesState(state, pending.data.state) ||
      pending.data.redirectUri !== `${origin}/api/upwork/callback` ||
      params.has("error")
    )
      return fail();
    const code = params.get("code");
    if (!code || code.length > 4096) return fail();
    try {
      const token = await exchangeCode(
        code,
        pending.data.redirectUri,
        pending.data.clientId,
        pending.data.verifier,
      );
      const sessionCookie = issueSession(Date.now(), "upwork");
      const session = verifySession(sessionCookie)!;
      const maxAge = Math.min(12 * 60 * 60, token.expires_in);
      const response = NextResponse.redirect(
        new URL(pending.data.returnTo ?? "/proposals", origin),
        {
          headers: {
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        },
      );
      const options = {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: origin.startsWith("https:"),
        path: "/",
        maxAge,
      };
      response.cookies.set(SESSION_COOKIE, sessionCookie, options);
      response.cookies.set(
        UPWORK_COOKIE,
        seal({
          accessToken: token.access_token,
          sessionId: session.id,
          expiresAt: Date.now() + maxAge * 1000,
        }),
        options,
      );
      return response;
    } catch {
      return fail();
    }
  } catch (error) {
    return errorResponse(error);
  }
}
