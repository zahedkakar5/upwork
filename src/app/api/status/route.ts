import { accessToken } from "@/lib/server/upwork/connection";
import { csrfForSession, requireApiSession } from "@/lib/server/session";
import { getAIConfig } from "@/lib/server/ai/config";
import { errorResponse } from "@/lib/server/errors";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request),
      config = getAIConfig();
    return Response.json(
      {
        aiConfigured: Boolean(config.apiKey),
        provider: config.provider,
        model: config.model,
        csrf: csrfForSession(session),
        upworkConnected: Boolean(await accessToken(session)),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
