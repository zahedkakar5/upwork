import { z } from "zod";
import { discoverySchema, discoveryQuery } from "@/lib/job-discovery";
import { requireApiSession } from "@/lib/server/session";
import { accessToken } from "@/lib/server/upwork/connection";
import { searchMcpJobs } from "@/lib/server/upwork/mcp";
import { rankJobs, normalizeSuggestedJobs } from "@/lib/job-suggestions";
import { readJson } from "@/lib/server/http";
import { AppError, errorResponse } from "@/lib/server/errors";
import { claimSearch } from "@/lib/server/search-cooldown";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, true);
    const input = discoverySchema
      .extend({ cursor: z.string().max(4000).optional() })
      .parse(await readJson(request, 8192));
    const filters = input;
    const token = await accessToken(session);
    if (!token)
      throw new AppError(409, "Connect Upwork MCP to discover suggested jobs.");
    const wait = claimSearch();
    if (wait)
      return Response.json(
        {
          error: `You’re refreshing too quickly. Wait ${wait} seconds before searching again.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(wait), "Cache-Control": "no-store" },
        },
      );
    const upstream: Record<string, string> = {};
    if (filters.category !== "All categories")
      upstream.category = filters.category;
    if (filters.jobType !== "all") upstream.job_type = filters.jobType;
    if (filters.experience !== "all")
      upstream.experience_level = filters.experience;
    if (filters.duration !== "all") upstream.duration = filters.duration;
    const raw = await searchMcpJobs(
      discoveryQuery(filters),
      token,
      upstream,
      input.cursor,
    );
    const result =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const data =
      result.data && typeof result.data === "object"
        ? (result.data as Record<string, unknown>)
        : result;
    const info =
      data.pageInfo && typeof data.pageInfo === "object"
        ? (data.pageInfo as Record<string, unknown>)
        : {};
    const cursor = data.next_cursor ?? info.endCursor;
    const nextCursor =
      (data.hasMore === true || info.hasNextPage === true) &&
      typeof cursor === "string"
        ? cursor
        : null;
    const candidates = normalizeSuggestedJobs(raw);
    const jobs = rankJobs(candidates, filters);
    return Response.json(
      {
        jobs,
        nextCursor,
        searchedAt: new Date().toISOString(),
        scanned: candidates.length,
        excluded: candidates.length - jobs.length,
        coverage:
          "Newest 10 results returned by Upwork for this query; not an exhaustive marketplace scan.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
