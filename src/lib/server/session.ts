import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AppError } from "./errors";
import { requestOrigin } from "./origin";

export const SESSION_COOKIE = "nordstone_preview";
const globals = globalThis as typeof globalThis & {
  nordstoneSessionSecret?: string;
};
const secret =
  process.env.SESSION_SECRET ||
  (globals.nordstoneSessionSecret ??= randomBytes(32).toString("hex"));
const sign = (value: string) =>
  createHmac("sha256", secret).update(value).digest("base64url");
const equal = (a: string, b: string) => {
  const first = Buffer.from(a),
    second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
};
export interface PreviewSession {
  mode: "preview" | "upwork";
  id: string;
  expiresAt: number;
}
export function issueSession(
  now = Date.now(),
  mode: PreviewSession["mode"] = "preview",
): string {
  const data: PreviewSession = {
    mode,
    id: randomBytes(24).toString("hex"),
    expiresAt: now + 12 * 60 * 60 * 1_000,
  };
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function verifySession(
  token: string | undefined,
  now = Date.now(),
): PreviewSession | null {
  if (!token || token.length > 1_024) return null;
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || !equal(sign(payload), signature))
      return null;
    const session: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    );
    if (typeof session !== "object" || !session) return null;
    const data = session as PreviewSession;
    return (data.mode === "preview" || data.mode === "upwork") &&
      typeof data.id === "string" &&
      typeof data.expiresAt === "number" &&
      data.expiresAt > now
      ? data
      : null;
  } catch {
    return null;
  }
}
export function csrfForSession(session: PreviewSession): string {
  return sign(`csrf:${session.id}`);
}
export function assertOrigin(request: Request): void {
  const expected = requestOrigin(request);
  const origin = request.headers.get("origin");
  if (origin && origin !== expected.origin)
    throw new AppError(403, "Invalid origin.");
  if (!["GET", "HEAD"].includes(request.method) && origin !== expected.origin)
    throw new AppError(403, "Invalid origin.");
}
export async function readSession(): Promise<PreviewSession | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}
export async function requireApiSession(
  request: Request,
  mutation = false,
): Promise<PreviewSession> {
  assertOrigin(request);
  const session = await readSession();
  if (!session)
    throw new AppError(401, "Your session ended. Open the workspace again.");
  if (
    mutation &&
    !equal(csrfForSession(session), request.headers.get("x-desk-token") ?? "")
  )
    throw new AppError(403, "Refresh the workspace and try again.");
  return session;
}
