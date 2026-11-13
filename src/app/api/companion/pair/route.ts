import { cookies } from "next/headers";
import {
  requireApiSession,
  csrfForSession,
  SESSION_COOKIE,
} from "@/lib/server/session";
import { accessToken, UPWORK_COOKIE } from "@/lib/server/upwork/connection";
import {
  assertLocalCompanion,
  createCompanionPair,
  clearCompanionPair,
} from "@/lib/server/companion";
import { AppError, errorResponse } from "@/lib/server/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertLocalCompanion(request);
    const session = await requireApiSession(request, true);
    if (!(await accessToken(session)))
      throw new AppError(409, "Connect Upwork locally before pairing.");
    const jar = await cookies();
    const cookie = [SESSION_COOKIE, UPWORK_COOKIE]
      .map((name) => `${name}=${jar.get(name)!.value}`)
      .join("; ");
    return Response.json(
      createCompanionPair({
        cookie,
        csrf: csrfForSession(session),
        sessionId: session.id,
        expiresAt: Math.min(
          session.expiresAt,
          Date.now() + 12 * 60 * 60 * 1000,
        ),
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertLocalCompanion(request);
    const session = await requireApiSession(request, true);
    clearCompanionPair(session.id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
