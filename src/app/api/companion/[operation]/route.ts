import {
  companionCors,
  companionOrigin,
  assertLocalCompanion,
  requireCompanionPair,
} from "@/lib/server/companion";
import { AppError, errorResponse } from "@/lib/server/errors";
import { readJson } from "@/lib/server/http";
export const runtime = "nodejs";
export async function OPTIONS(request: Request) {
  try {
    assertLocalCompanion(request);
    return companionCors(request, new Response(null, { status: 204 }));
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ operation: string }> },
) {
  try {
    const pair = requireCompanionPair(request);
    console.info("Companion read request accepted");
    const { operation } = await context.params;
    const path = (
      {
        status: "/api/status",
        suggestions: "/api/upwork/suggestions",
        job: "/api/upwork/job",
      } as Record<string, string>
    )[operation];
    if (!path)
      throw new AppError(
        404,
        "The companion only supports reading jobs and connection status.",
      );
    const body =
      operation === "status"
        ? undefined
        : JSON.stringify(await readJson(request, 8192));
    const upstream = await fetch(companionOrigin + path, {
      method: operation === "status" ? "GET" : "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
      headers: {
        "Content-Type": "application/json",
        Origin: companionOrigin,
        Cookie: pair.cookie,
        "X-Desk-Token": pair.csrf,
      },
      body,
    });
    const result = await upstream.json();
    console.info("Companion local read completed", {
      operation,
      status: upstream.status,
    });
    return companionCors(
      request,
      Response.json(
        operation === "status" && upstream.ok
          ? {
              upworkConnected: result.upworkConnected,
              expiresAt: pair.expiresAt,
            }
          : result,
        { status: upstream.status },
      ),
    );
  } catch (error) {
    return companionCors(request, errorResponse(error));
  }
}
