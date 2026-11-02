import { z } from "zod";
import { requireApiSession } from "@/lib/server/session";
import { accessToken } from "@/lib/server/upwork/connection";
import { searchMcpJobs } from "@/lib/server/upwork/mcp";
import { projectSearches, normalizeSuggestedJobs } from "@/lib/job-suggestions";
import { readJson } from "@/lib/server/http";
import { AppError, errorResponse } from "@/lib/server/errors";
import { claimSearch } from "@/lib/server/search-cooldown";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, true);
    const { category } = z
      .object({ category: z.string().max(100) })
      .parse(await readJson(request, 1024));
    const search = projectSearches.find((s) => s.category === category);
    if (!search) throw new AppError(400, "Choose a project category.");
    const token = await accessToken(session);
    if (!token)
      throw new AppError(409, "Connect Upwork MCP to discover suggested jobs.");
    const wait = claimSearch();
    if (wait) return Response.json(
      { error: `You’re refreshing too quickly. Wait ${wait} seconds before searching again.` },
      { status: 429, headers: { "Retry-After": String(wait), "Cache-Control": "no-store" } },
    );
    const jobs = normalizeSuggestedJobs(
      await searchMcpJobs(search.query, token),
    );
    return Response.json(
      { jobs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
