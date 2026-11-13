import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { AppError } from "./errors";

type Pair = {
  digest: string;
  cookie: string;
  csrf: string;
  sessionId: string;
  expiresAt: number;
};
const state = globalThis as typeof globalThis & {
  nordstoneCompanionPair?: Pair;
};
export const companionOrigin = "http://127.0.0.1:8765";
export const companionWebsite = "https://upwork-application-omega.vercel.app";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function assertLocalCompanion(request: Request) {
  if (
    process.env.VERCEL === "1" ||
    new URL(request.url).protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(new URL(request.url).hostname) ||
    new URL(request.url).port !== "8765" ||
    request.headers.get("host") !== "127.0.0.1:8765"
  )
    throw new AppError(
      403,
      "The companion runs only on this computer at 127.0.0.1:8765.",
    );
}
export function createCompanionPair(input: Omit<Pair, "digest">) {
  const code = randomBytes(32).toString("base64url");
  state.nordstoneCompanionPair = { ...input, digest: digest(code) };
  return { code, expiresAt: input.expiresAt };
}
export function clearCompanionPair(sessionId?: string) {
  if (!sessionId || state.nordstoneCompanionPair?.sessionId === sessionId)
    delete state.nordstoneCompanionPair;
}
export function requireCompanionPair(request: Request) {
  assertLocalCompanion(request);
  if (request.headers.get("origin") !== companionWebsite)
    throw new AppError(
      403,
      "This website is not allowed to use the companion.",
    );
  const code =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const pair = state.nordstoneCompanionPair;
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(code) ||
    !pair ||
    pair.expiresAt <= Date.now() ||
    digest(code) !== pair.digest
  )
    throw new AppError(
      401,
      "Companion pairing expired or was revoked. Pair again on your computer.",
    );
  return pair;
}
export function companionCors(request: Request, response: Response) {
  if (request.headers.get("origin") === companionWebsite) {
    response.headers.set("Access-Control-Allow-Origin", companionWebsite);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    response.headers.set("Access-Control-Allow-Private-Network", "true");
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
