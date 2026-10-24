import { profileSchema } from "@/lib/schemas";
import { requireApiSession } from "@/lib/server/session";
import { profileStore } from "@/lib/server/profile-store";
import { readJson } from "@/lib/server/http";
import { errorResponse } from "@/lib/server/errors";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await requireApiSession(request);
    return Response.json(
      { profile: await profileStore.load() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    await requireApiSession(request, true);
    const input = profileSchema.parse(await readJson(request));
    return Response.json(
      { profile: await profileStore.save(input, input.version) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
