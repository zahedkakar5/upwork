import { requestOrigin } from "@/lib/server/origin";
import { errorResponse } from "@/lib/server/errors";
import { clientMetadata } from "@/lib/server/upwork/connection";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const origin = requestOrigin(request).origin;
    return Response.json(clientMetadata(origin), {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
