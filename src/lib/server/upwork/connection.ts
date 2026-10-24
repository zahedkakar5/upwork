import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { AppError } from "../errors";
import type { PreviewSession } from "../session";

export const UPWORK_COOKIE = "nordstone_upwork";
export const OAUTH_COOKIE = "nordstone_oauth";
export function upworkConfigured(): boolean {
  return Boolean(
    process.env.UPWORK_CLIENT_ID &&
    process.env.UPWORK_CLIENT_SECRET &&
    process.env.SESSION_SECRET,
  );
}
function key() {
  if (!process.env.SESSION_SECRET)
    throw new AppError(
      503,
      "Set a stable SESSION_SECRET before connecting Upwork.",
    );
  return createHash("sha256").update(process.env.SESSION_SECRET).digest();
}
export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
export function unseal(value: string | undefined): unknown {
  if (!value || value.length > 5000) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      bytes.subarray(0, 12),
    );
    cipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        cipher.update(bytes.subarray(28)),
        cipher.final(),
      ]).toString(),
    );
  } catch {
    return null;
  }
}
export function matchesState(first: string, second: string): boolean {
  const a = Buffer.from(first),
    b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
}
const credentialSchema = z.object({
  accessToken: z.string().min(1),
  sessionId: z.string(),
  expiresAt: z.number(),
});
export async function accessToken(
  session: PreviewSession,
): Promise<string | null> {
  if (session.mode !== "upwork") return null;
  const result = credentialSchema.safeParse(
    unseal((await cookies()).get(UPWORK_COOKIE)?.value),
  );
  if (
    !result.success ||
    result.data.sessionId !== session.id ||
    result.data.expiresAt <= Date.now()
  )
    return null;
  return result.data.accessToken;
}
export async function exchangeCode(code: string, redirectUri: string) {
  if (!upworkConfigured())
    throw new AppError(
      503,
      "Upwork connection needs an approved Client ID and Client Secret on the server.",
    );
  let response: Response;
  try {
    response = await fetch("https://www.upwork.com/api/v3/oauth2/token", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.UPWORK_CLIENT_ID!,
        client_secret: process.env.UPWORK_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
      }),
    });
  } catch {
    throw new AppError(502, "Upwork did not respond. Try connecting again.");
  }
  if (!response.ok)
    throw new AppError(
      502,
      "Upwork declined authorization. Check the app credentials and registered callback URL.",
    );
  const parsed = z
    .object({
      access_token: z.string().min(1).max(1800),
      expires_in: z.coerce.number().positive().default(86400),
    })
    .safeParse(await response.json());
  if (!parsed.success)
    throw new AppError(
      502,
      "Upwork returned an invalid authorization response.",
    );
  return parsed.data;
}
