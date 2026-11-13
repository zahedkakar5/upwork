import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  assertLocalCompanion,
  createCompanionPair,
  clearCompanionPair,
  requireCompanionPair,
  companionCors,
  companionOrigin,
  companionWebsite,
} from "../src/lib/server/companion";
import { POST, OPTIONS } from "../src/app/api/companion/[operation]/route";
const input = {
  cookie: "private-local-cookie",
  csrf: "private-local-csrf",
  sessionId: "fixture-session",
  expiresAt: Date.now() + 60_000,
};
function request(code = "", origin = companionWebsite, operation = "status") {
  return new Request(`${companionOrigin}/api/companion/${operation}`, {
    method: "POST",
    headers: {
      host: "127.0.0.1:8765",
      origin,
      authorization: `Bearer ${code}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
}
beforeEach(() => {
  vi.stubEnv("VERCEL", "0");
  clearCompanionPair();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearCompanionPair();
});
describe("local companion boundaries", () => {
  it("never enables the companion on Vercel or other hosts", () => {
    expect(() =>
      assertLocalCompanion(
        new Request("http://evil.example/api/companion/status", {
          headers: { host: "evil.example" },
        }),
      ),
    ).toThrow();
    vi.stubEnv("VERCEL", "1");
    expect(() => assertLocalCompanion(request())).toThrow();
  });
  it("accepts Next's internal localhost URL only with the exact loopback Host", () => {
    expect(() =>
      assertLocalCompanion(
        new Request("http://localhost:8765/api/companion/status", {
          headers: { host: "127.0.0.1:8765" },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      assertLocalCompanion(
        new Request("http://localhost:8765/api/companion/status", {
          headers: { host: "evil.example" },
        }),
      ),
    ).toThrow();
  });
  it("requires the exact paired website and an unguessable code", () => {
    const pair = createCompanionPair(input);
    expect(() => requireCompanionPair(request("bad"))).toThrow();
    expect(() =>
      requireCompanionPair(request(pair.code, "https://evil.example")),
    ).toThrow();
    expect(requireCompanionPair(request(pair.code)).sessionId).toBe(
      input.sessionId,
    );
  });
  it("expires, rotates and revokes pairing", () => {
    const first = createCompanionPair(input);
    const next = createCompanionPair(input);
    expect(() => requireCompanionPair(request(first.code))).toThrow();
    clearCompanionPair("another-session");
    expect(requireCompanionPair(request(next.code))).toBeDefined();
    clearCompanionPair(input.sessionId);
    expect(() => requireCompanionPair(request(next.code))).toThrow();
    const expired = createCompanionPair({
      ...input,
      expiresAt: Date.now() - 1,
    });
    expect(() => requireCompanionPair(request(expired.code))).toThrow();
  });
  it("allows CORS only for the fixed website, including local-network preflight", async () => {
    const allowed = await OPTIONS(request());
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(
      companionWebsite,
    );
    expect(
      companionCors(
        request("", "https://evil.example"),
        new Response(),
      ).headers.has("Access-Control-Allow-Origin"),
    ).toBe(false);
  });
  it("proxies status without exposing local cookies, csrf or provider configuration", async () => {
    const pair = createCompanionPair(input);
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        upworkConnected: true,
        csrf: "never-to-browser",
        model: "private-config",
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const r = await POST(request(pair.code), {
      params: Promise.resolve({ operation: "status" }),
    });
    expect(await r.json()).toEqual({
      upworkConnected: true,
      expiresAt: input.expiresAt,
    });
    expect(fetch.mock.calls[0]?.[0]).toBe(`${companionOrigin}/api/status`);
    expect(fetch.mock.calls[0]?.[1]?.headers.Cookie).toBe(input.cookie);
  });
  it("never proxies submission, arbitrary URLs or unsupported operations", async () => {
    const pair = createCompanionPair(input);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const r = await POST(request(pair.code), {
      params: Promise.resolve({ operation: "application" }),
    });
    expect(r.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
});
