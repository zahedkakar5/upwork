import { requireApiSession } from "@/lib/server/session";
import { errorResponse } from "@/lib/server/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await requireApiSession(request, true);
    return Response.json(
      {
        error:
          "Submission from this app is disabled. Review and submit every proposal manually on Upwork.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
