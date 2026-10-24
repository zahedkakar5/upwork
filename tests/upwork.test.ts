import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const jar = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
import {
  seal,
  unseal,
  matchesState,
  exchangeCode,
  accessToken,
  upworkConfigured,
} from "../src/lib/server/upwork/connection";
import { fetchJobDetails, jobIdFromUrl } from "../src/lib/server/upwork/jobs";
import { POST as startLogin } from "../src/app/api/upwork/login/route";
import { GET as finishLogin } from "../src/app/api/upwork/callback/route";
import { assertOrigin, verifySession } from "../src/lib/server/session";
const origin = "http://127.0.0.1:8765";
const jobUrl =
  "https://www.upwork.com/jobs/Test-project_~022056488576136638272/";
beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret-for-fixtures-only");
  vi.stubEnv("UPWORK_CLIENT_ID", "fixture-client");
  vi.stubEnv("UPWORK_CLIENT_SECRET", "fixture-secret");
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("VERCEL", "0");
  jar.get.mockReset();
  jar.set.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Upwork connection", () => {
  it("encrypts credentials and rejects tampering and wrong encryption keys", () => {
    const sealed = seal({ token: "fixture-token" });
    expect(sealed).not.toContain("fixture-token");
    expect(unseal(sealed)).toEqual({ token: "fixture-token" });
    expect(unseal(sealed.slice(0, -4))).toBeNull();
    vi.stubEnv("SESSION_SECRET", "another-fixture-secret");
    expect(unseal(sealed)).toBeNull();
    expect(matchesState("a", "aa")).toBe(false);
  });
  it("requires real configuration rather than reporting fake login", async () => {
    vi.stubEnv("UPWORK_CLIENT_ID", "");
    expect(upworkConfigured()).toBe(false);
    expect(
      (
        await startLogin(
          new Request(`${origin}/api/upwork/login`, {
            method: "POST",
            headers: {
              host: "127.0.0.1:8765",
              origin,
              "Content-Type": "application/json",
            },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(503);
  });
  it("starts authorization with a private expiring state cookie and registered callback", async () => {
    const response = await startLogin(
      new Request(`${origin}/api/upwork/login`, {
        method: "POST",
        headers: {
          host: "127.0.0.1:8765",
          origin,
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    );
    const { url } = await response.json();
    const authorize = new URL(url);
    expect(authorize.hostname).toBe("www.upwork.com");
    expect(authorize.searchParams.get("redirect_uri")).toBe(
      `${origin}/api/upwork/callback`,
    );
    expect(authorize.searchParams.has("client_secret")).toBe(false);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });
  it("rejects callback state mismatch without contacting Upwork", async () => {
    jar.get.mockReturnValue({
      value: seal({
        state: "expected",
        redirectUri: `${origin}/api/upwork/callback`,
        expiresAt: Date.now() + 10000,
      }),
    });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await finishLogin(
      new Request(`${origin}/api/upwork/callback?code=fixture&state=wrong`, {
        headers: { host: "127.0.0.1:8765" },
      }),
    );
    expect(response.headers.get("location")).toContain("connection=failed");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("creates an Upwork session only after a successful token exchange", async () => {
    jar.get.mockReturnValue({
      value: seal({
        state: "expected",
        redirectUri: `${origin}/api/upwork/callback`,
        expiresAt: Date.now() + 10000,
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ access_token: "fixture-access", expires_in: 3600 }),
        ),
    );
    const response = await finishLogin(
      new Request(`${origin}/api/upwork/callback?code=fixture&state=expected`, {
        headers: { host: "127.0.0.1:8765" },
      }),
    );
    expect(response.headers.get("location")).toBe(`${origin}/proposals`);
    const session = (response as NextResponse).cookies.get(
      "nordstone_preview",
    )!.value;
    expect(verifySession(session)?.mode).toBe("upwork");
    expect(response.headers.get("set-cookie")).not.toContain("fixture-access");
    expect(jar.set).toHaveBeenCalledWith("nordstone_oauth", "", {
      path: "/api/upwork",
      maxAge: 0,
    });
  });
  it("binds tokens to the session and rejects expired or preview credentials", async () => {
    jar.get.mockReturnValue({
      value: seal({
        accessToken: "fixture-access",
        sessionId: "one",
        expiresAt: Date.now() + 10000,
      }),
    });
    expect(
      await accessToken({
        mode: "upwork",
        id: "one",
        expiresAt: Date.now() + 10000,
      }),
    ).toBe("fixture-access");
    expect(
      await accessToken({
        mode: "upwork",
        id: "two",
        expiresAt: Date.now() + 10000,
      }),
    ).toBeNull();
    expect(
      await accessToken({
        mode: "preview",
        id: "one",
        expiresAt: Date.now() + 10000,
      }),
    ).toBeNull();
    jar.get.mockReturnValue({
      value: seal({
        accessToken: "fixture-access",
        sessionId: "one",
        expiresAt: 1,
      }),
    });
    expect(
      await accessToken({
        mode: "upwork",
        id: "one",
        expiresAt: Date.now() + 10000,
      }),
    ).toBeNull();
  });
  it("does not leak upstream errors from authorization", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: "fixture-private-upstream-data" },
            { status: 400 },
          ),
        ),
    );
    await expect(
      exchangeCode("fixture", `${origin}/api/upwork/callback`),
    ).rejects.toThrow("Upwork declined authorization");
  });
});
describe("job import", () => {
  it("extracts numeric identifiers and rejects arbitrary destinations and legacy IDs", () => {
    expect(jobIdFromUrl(jobUrl)).toBe("2056488576136638272");
    expect(
      jobIdFromUrl(
        "https://www.upwork.com/nx/search/jobs/details/~022056488576136638272",
      ),
    ).toBe("2056488576136638272");
    for (const url of [
      "http://127.0.0.1/private",
      "https://upwork.com.evil.test/jobs/x_~022056488576136638272/",
      "https://user:pass@www.upwork.com/jobs/x_~022056488576136638272/",
      "https://www.upwork.com/jobs/x_~01abcdef/",
    ])
      expect(() => jobIdFromUrl(url)).toThrow();
  });
  it("requests only the official API and returns validated title and brief", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          marketplaceJobPosting: {
            content: {
              title: "Fixture title",
              description: "Fixture requirements",
            },
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    expect(await fetchJobDetails(jobUrl, "fixture-access")).toEqual({
      title: "Fixture title",
      summary: "Fixture requirements",
    });
    expect(fetch.mock.calls[0]![0]).toBe("https://api.upwork.com/graphql");
    expect(JSON.parse(fetch.mock.calls[0]![1].body).variables.id).toBe(
      "2056488576136638272",
    );
  });
  it("rejects GraphQL failures and missing content instead of fabricating a brief", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ errors: [{ message: "fixture-private" }] }),
        ),
    );
    await expect(fetchJobDetails(jobUrl, "fixture-access")).rejects.toThrow(
      "Check your API permissions",
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ data: { marketplaceJobPosting: null } }),
        ),
    );
    await expect(fetchJobDetails(jobUrl, "fixture-access")).rejects.toThrow(
      "Job details are unavailable",
    );
  });
});
describe("Vercel origins", () => {
  it("accepts exact platform domains while rejecting other hosts and cross-origin writes", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_URL", "fixture-preview.vercel.app");
    const request = (host: string, origin: string) =>
      new Request(`https://${host}/api/session`, {
        method: "POST",
        headers: { host, origin },
      });
    expect(() =>
      assertOrigin(
        request(
          "fixture-preview.vercel.app",
          "https://fixture-preview.vercel.app",
        ),
      ),
    ).not.toThrow();
    expect(() =>
      assertOrigin(request("evil.test", "https://evil.test")),
    ).toThrow();
    expect(() =>
      assertOrigin(request("fixture-preview.vercel.app", "https://evil.test")),
    ).toThrow();
  });
});
