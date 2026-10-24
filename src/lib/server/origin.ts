import "server-only";
import { AppError } from "./errors";

export function allowedOrigins(): URL[] {
  const values = [process.env.APP_ORIGIN || "http://127.0.0.1:8765"];
  if (process.env.VERCEL === "1") {
    for (const name of [
      "VERCEL_URL",
      "VERCEL_BRANCH_URL",
      "VERCEL_PROJECT_PRODUCTION_URL",
    ]) {
      const host = process.env[name];
      if (host && /^[a-z0-9.-]+$/i.test(host)) values.push(`https://${host}`);
    }
  }
  return values.map((value) => new URL(value));
}
export function requestOrigin(request: Request): URL {
  const expected = allowedOrigins().find(
    (url) => url.host === request.headers.get("host"),
  );
  if (!expected || new URL(request.url).protocol !== expected.protocol)
    throw new AppError(403, "Invalid host.");
  return expected;
}
