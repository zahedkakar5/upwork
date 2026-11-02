import { z } from "zod";
import { requireApiSession } from "@/lib/server/session";
import { accessToken } from "@/lib/server/upwork/connection";
import { AppError, errorResponse } from "@/lib/server/errors";
import { readJson } from "@/lib/server/http";
import { submissionSnapshotSchema } from "@/lib/submission";
import {
  inspectApplication,
  previewApplication,
  confirmApplication,
} from "@/lib/server/upwork/submission-service";
export const runtime = "nodejs";
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("inspect"),
    url: z.string().max(2048),
    accountId: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal("preview"),
    snapshot: submissionSnapshotSchema,
    approvePreview: z.literal(true),
  }),
  z.object({
    action: z.literal("confirm"),
    snapshot: submissionSnapshotSchema,
    reviewId: z.string().uuid(),
    maxConnects: z.number().int().nonnegative(),
    confirmSpend: z.literal(true),
  }),
]);
export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, true);
    const input = schema.parse(await readJson(request));
    const token = await accessToken(session);
    if (!token)
      throw new AppError(
        409,
        "Reconnect Upwork MCP before reviewing Connects or submitting.",
      );
    const result =
      input.action === "inspect"
        ? await inspectApplication(token, input.url, input.accountId)
        : input.action === "preview"
          ? await previewApplication(token, session.id, input.snapshot)
          : await confirmApplication(
              token,
              session.id,
              input.reviewId,
              input.snapshot,
              input.maxConnects,
            );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
