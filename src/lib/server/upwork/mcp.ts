import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { screeningFrom } from "../../job-discovery";
import { selectWorkAccount } from "./accounts";
import { reserveRead } from "./read-budget";
import { AppError } from "../errors";

const endpoint = "https://mcp.upwork.com/mcp";
const jobSchema = z.object({
  title: z.string().trim().min(1).max(20_000),
  description: z.string().trim().min(1).max(20_000),
});
const participantWrapper =
  /^<untrusted_participant_content>\s*([\s\S]*?)\s*<\/untrusted_participant_content>$/;

function toolData(result: {
  structuredContent?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string }>;
}): unknown {
  if (result.structuredContent) return result.structuredContent;
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) return result;
  try {
    return JSON.parse(text);
  } catch {
    return result;
  }
}
function findJob(value: unknown) {
  const candidates: unknown[] = [value];
  if (typeof value === "object" && value) {
    const record = value as Record<string, unknown>;
    candidates.push(record.job, record.data);
    if (typeof record.data === "object" && record.data)
      candidates.push(
        (record.data as Record<string, unknown>).marketplaceJobPosting,
        (
          (record.data as Record<string, unknown>).marketplaceJobPosting as
            Record<string, unknown> | undefined
        )?.content,
      );
  }
  for (const candidate of candidates) {
    const parsed = jobSchema.safeParse(candidate);
    if (parsed.success)
      return {
        title: parsed.data.title,
        questions: screeningFrom(
          (candidate as Record<string, unknown>).screening_questions ??
            (candidate as Record<string, unknown>).questions ??
            (typeof value === "object" && value
              ? (value as Record<string, unknown>).screening_questions
              : undefined),
        ),
        summary: parsed.data.description
          .replace(participantWrapper, "$1")
          .trim(),
      };
  }
  throw new AppError(
    404,
    "Job details are unavailable. The job may be private, closed or inaccessible to this account.",
  );
}

export async function fetchMcpJobDetails(url: string, token: string) {
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client({
    name: "Nordstone Proposal Desk",
    version: "1.0.0",
  });
  try {
    await client.connect(transport);
    const accountsResult = await client.callTool({
      name: "upwork__list_accounts",
      arguments: {},
    });
    if ("toolResult" in accountsResult || accountsResult.isError)
      throw new AppError(
        502,
        "Upwork MCP could not retrieve your account information.",
      );
    const account = selectWorkAccount(toolData(accountsResult));
    await reserveRead();
    const jobResult = await client.callTool({
      name: "upwork__find_jobs",
      arguments: {
        action: "get",
        org_uid: account.org_uid,
        params: { id: url },
      },
    });
    if ("toolResult" in jobResult || jobResult.isError)
      throw new AppError(502, "Upwork MCP could not retrieve this job.");
    return findJob(toolData(jobResult));
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(
      "Upwork MCP import failed",
      error instanceof Error ? error.message : error,
    );
    throw new AppError(502, "Upwork MCP could not retrieve this job.");
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function searchMcpJobs(
  query: string,
  token: string,
  filters: Record<string, string> = {},
  cursor?: string,
) {
  const client = new Client({
    name: "Nordstone Proposal Desk",
    version: "1.0.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    if (!tools.tools.some((tool) => tool.name === "upwork__find_jobs"))
      throw new AppError(
        502,
        "Job search is not available on this Upwork MCP connection.",
      );
    const accounts = await client.callTool({
      name: "upwork__list_accounts",
      arguments: {},
    });
    if ("toolResult" in accounts || accounts.isError)
      throw new AppError(502, "Upwork could not load your accounts.");
    const account = selectWorkAccount(toolData(accounts));
    await reserveRead();
    const result = await client.callTool({
      name: "upwork__find_jobs",
      arguments: {
        action: "search",
        org_uid: account.org_uid,
        params: {
          query,
          limit: 10,
          include_full_details: true,
          sort: "recency",
          ...filters,
          ...(cursor ? { cursor } : {}),
        },
      },
    });
    if ("toolResult" in result || result.isError)
      throw new AppError(502, "Upwork could not search for jobs. Try again.");
    const data = toolData(result);
    return data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      502,
      "Upwork job search could not complete. Reconnect Upwork or try again.",
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}

/** Discover the authenticated server contract without performing any write. */
export async function inspectSubmissionTools(token: string) {
  const client = new Client({
    name: "Nordstone Proposal Desk",
    version: "1.0.0",
  });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(endpoint), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    const found = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools(cursor ? { cursor } : {});
      found.push(
        ...page.tools.filter((tool) =>
          /proposal|connects|confirm|tool_help/i.test(
            tool.name + " " + tool.description,
          ),
        ),
      );
      cursor = page.nextCursor;
    } while (cursor);
    return found;
  } catch {
    throw new AppError(
      502,
      "Could not inspect Upwork submission tools. Reconnect Upwork and try again.",
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}
