import { z } from "zod";
import { requireApiSession } from "@/lib/server/session";
import { accessToken } from "@/lib/server/upwork/connection";
import { fetchJobDetails, jobIdFromUrl } from "@/lib/server/upwork/jobs";
import { readJson } from "@/lib/server/http";
import { AppError, errorResponse } from "@/lib/server/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, true);
    const { url } = z
      .object({ url: z.string().max(2048) })
      .parse(await readJson(request, 4096));
    jobIdFromUrl(url);
    const token = await accessToken(session);
    if (!token)
      throw new AppError(
        409,
        "Connect Upwork first to import job details. You can still enter the title and brief manually.",
      );
    return Response.json(await fetchJobDetails(url, token), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
