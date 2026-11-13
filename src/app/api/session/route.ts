import { clearCompanionPair } from "@/lib/server/companion";
import { UPWORK_COOKIE, OAUTH_COOKIE } from "@/lib/server/upwork/connection";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  assertOrigin,
  issueSession,
  requireApiSession,
  SESSION_COOKIE,
} from "@/lib/server/session";
import { readJson } from "@/lib/server/http";
import { errorResponse } from "@/lib/server/errors";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    z.object({ preview: z.literal(true) }).parse(await readJson(request, 128));
    const response = NextResponse.json(
      { mode: "preview" },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.delete(UPWORK_COOKIE);
    response.cookies.set(OAUTH_COOKIE, "", { path: "/api/upwork", maxAge: 0 });
    response.cookies.set(SESSION_COOKIE, issueSession(), {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const session = await requireApiSession(request, true);
    clearCompanionPair(session.id);
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    jar.delete(UPWORK_COOKIE);
    jar.set(OAUTH_COOKIE, "", { path: "/api/upwork", maxAge: 0 });
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
