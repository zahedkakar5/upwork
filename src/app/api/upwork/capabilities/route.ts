import { requireApiSession } from "@/lib/server/session";
import { accessToken } from "@/lib/server/upwork/connection";
import { inspectSubmissionTools } from "@/lib/server/upwork/mcp";
import { AppError, errorResponse } from "@/lib/server/errors";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request);
    const token = await accessToken(session);
    if (!token) throw new AppError(409, "Reconnect Upwork MCP to check proposal submission and Connects.");
    const tools = await inspectSubmissionTools(token);
    return Response.json({tools}, {headers:{"Cache-Control":"no-store"}});
  } catch(error) { return errorResponse(error); }
}
