import { draftRequestSchema } from "@/lib/schemas";
import { requireApiSession } from "@/lib/server/session";
import { profileStore } from "@/lib/server/profile-store";
import { generateDraft } from "@/lib/server/ai/drafting";
import { readJson } from "@/lib/server/http";
import { AppError, errorResponse } from "@/lib/server/errors";
export const runtime = "nodejs";
export const maxDuration = 100;
const globals = globalThis as typeof globalThis & {
  nordstoneDraftRequests?: Set<string>;
};
const inFlight = (globals.nordstoneDraftRequests ??= new Set<string>());
export async function POST(request: Request) {
  let sessionId: string | undefined;
  try {
    const session = await requireApiSession(request, true);
    const input = draftRequestSchema.parse(await readJson(request));
    if (inFlight.has(session.id))
      throw new AppError(
        429,
        "A proposal is already being prepared. Please wait.",
      );
    sessionId = session.id;
    inFlight.add(sessionId);
    return Response.json(await generateDraft(input, profileStore), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  } finally {
    if (sessionId) inFlight.delete(sessionId);
  }
}
