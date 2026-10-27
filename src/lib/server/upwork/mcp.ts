import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { AppError } from "../errors";

const endpoint = "https://mcp.upwork.com/mcp";
const accountSchema = z.object({ org_uid: z.string().min(1), role: z.enum(["TALENT", "FL_AGENCY"]) });
const jobSchema = z.object({ title: z.string().trim().min(1).max(20_000), description: z.string().trim().min(1).max(20_000) });
const participantWrapper = /^<untrusted_participant_content>\s*([\s\S]*?)\s*<\/untrusted_participant_content>$/;

function toolData(result: { structuredContent?: Record<string, unknown>; content?: Array<{ type: string; text?: string }> }): unknown {
  if (result.structuredContent) return result.structuredContent;
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) return result;
  try { return JSON.parse(text); } catch { return result; }
}
function findAccount(value: unknown) {
  const nested = typeof value === "object" && value ? (value as Record<string, unknown>).accounts : undefined;
  const accounts = z.array(accountSchema).safeParse(nested ?? value);
  if (!accounts.success) throw new AppError(502, "Upwork MCP returned invalid account information.");
  if (accounts.data.length === 1) return accounts.data[0]!;
  const agency = accounts.data.filter((account) => account.role === "FL_AGENCY");
  if (agency.length === 1) return agency[0]!;
  throw new AppError(409, "Choose one Upwork freelancer or agency account before importing a job.");
}
function findJob(value: unknown) {
  const candidates: unknown[] = [value];
  if (typeof value === "object" && value) {
    const record = value as Record<string, unknown>;
    candidates.push(record.job, record.data);
    if (typeof record.data === "object" && record.data)
      candidates.push(
        (record.data as Record<string, unknown>).marketplaceJobPosting,
        ((record.data as Record<string, unknown>).marketplaceJobPosting as Record<string, unknown> | undefined)?.content,
      );
  }
  for (const candidate of candidates) {
    const parsed = jobSchema.safeParse(candidate);
    if (parsed.success)
      return {
        title: parsed.data.title,
        summary: parsed.data.description.replace(participantWrapper, "$1").trim(),
      };
  }
  throw new AppError(404, "Job details are unavailable. The job may be private, closed or inaccessible to this account.");
}

export async function fetchMcpJobDetails(url: string, token: string) {
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client({ name: "Nordstone Proposal Desk", version: "1.0.0" });
  try {
    await client.connect(transport);
    const accountsResult = await client.callTool({ name: "upwork__list_accounts", arguments: {} });
    if ("toolResult" in accountsResult || accountsResult.isError) throw new AppError(502, "Upwork MCP could not retrieve your account information.");
    const account = findAccount(toolData(accountsResult));
    const jobResult = await client.callTool({
      name: "upwork__find_jobs",
      arguments: { action: "get", org_uid: account.org_uid, params: { id: url } },
    });
    if ("toolResult" in jobResult || jobResult.isError) throw new AppError(502, "Upwork MCP could not retrieve this job.");
    return findJob(toolData(jobResult));
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Upwork MCP import failed", error instanceof Error ? error.message : error);
    throw new AppError(502, "Upwork MCP could not retrieve this job.");
  } finally {
    await client.close().catch(() => undefined);
  }
}
