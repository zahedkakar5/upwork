import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { AppError } from "../errors";
export type Data = Record<string, unknown>;
export function record(value: unknown): Data {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Data)
    : {};
}
export function unwrap(value: unknown): Data {
  const r = record(value);
  return Object.keys(record(r.data)).length ? record(r.data) : r;
}
export function toolData(result: Data): unknown {
  if (result.isError || "toolResult" in result)
    throw new AppError(
      502,
      "Upwork refused this operation. Review the account, required job fields and any notices on Upwork before retrying.",
    );
  if (result.structuredContent) return result.structuredContent;
  const parts = Array.isArray(result.content) ? result.content : [];
  const text = parts.map(record).find((p) => p.type === "text")?.text;
  if (typeof text !== "string")
    throw new AppError(
      502,
      "Upwork returned an unreadable response. No success has been assumed.",
    );
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(
      502,
      "Upwork returned an unrecognized response. Check Upwork directly.",
    );
  }
}
export async function withSubmissionClient<T>(
  token: string,
  work: (call: (name: string, args: Data) => Promise<unknown>) => Promise<T>,
): Promise<T> {
  const client = new Client({
    name: "Nordstone Proposal Desk",
    version: "1.0.0",
  });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL("https://mcp.upwork.com/mcp"), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    const tools: Tool[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools(cursor ? { cursor } : {});
      tools.push(...page.tools);
      cursor = page.nextCursor;
    } while (cursor);
    const allowed = new Set([
      "upwork__list_accounts",
      "upwork__find_jobs",
      "upwork__get_profile",
      "upwork__get_freelancer_financials",
      "upwork__list_freelancer_proposals",
      "upwork__manage_proposals",
      "upwork__confirm_preview",
    ]);
    const validator = new AjvJsonSchemaValidator();
    return await work(async (name, args) => {
      const tool = tools.find((t) => t.name === name);
      if (!allowed.has(name) || !tool)
        throw new AppError(
          409,
          "The required submission capability is unavailable. Use Upwork directly.",
        );
      if (
        name === "upwork__manage_proposals" ||
        name === "upwork__confirm_preview"
      ) {
        const schema = record(tool.inputSchema);
        const branches = Array.isArray(schema.allOf)
          ? schema.allOf.map(record)
          : [];
        const matching = branches.filter(
          (branch) =>
            record(record(record(branch.if).properties).action).const ===
            args.action,
        );
        const paramsSchemas = [
          record(record(schema.properties).params),
          ...matching.map((branch) =>
            record(record(record(branch.then).properties).params),
          ),
        ];
        const known = new Set(
          paramsSchemas.flatMap((item) => Object.keys(record(item.properties))),
        );
        if (Object.keys(record(args.params)).some((key) => !known.has(key)))
          throw new AppError(
            409,
            "Upwork’s live submission fields differ from this app’s verified mapping. Manual submission is available; no confirmation was sent.",
          );
      }
      let valid = false;
      try {
        valid = validator.getValidator(tool.inputSchema)(args).valid;
      } catch {
        /* Fail closed on unknown schemas. */
      }
      if (!valid)
        throw new AppError(
          409,
          "Upwork requires submission fields this app has not yet verified. Use manual submission until this connection is checked.",
        );
      return toolData(
        (await client.callTool({ name, arguments: args })) as Data,
      );
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      502,
      "The Upwork request did not complete. Check proposals and Connects before retrying a submission.",
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}
