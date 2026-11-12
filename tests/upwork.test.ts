import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));

import {
  accessToken,
  authorizationClient,
  clientMetadata,
  createPkce,
  exchangeCode,
  matchesState,
  registerClient,
  seal,
  unseal,
  upworkConfigured,
} from "../src/lib/server/upwork/connection";
import { jobIdFromUrl } from "../src/lib/server/upwork/jobs";
import { POST as startLogin } from "../src/app/api/upwork/login/route";
import { GET as finishLogin } from "../src/app/api/upwork/callback/route";
import { assertOrigin, verifySession } from "../src/lib/server/session";

const origin = "http://127.0.0.1:8765";
const jobUrl =
  "https://www.upwork.com/jobs/Test-project_~022056488576136638272/";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret-for-fixtures-only");
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("VERCEL", "0");
  jar.get.mockReset();
  jar.set.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Upwork MCP connection", () => {
  it("encrypts credentials and rejects tampering and wrong encryption keys", () => {
    const sealed = seal({ token: "fixture-token" });
    expect(sealed).not.toContain("fixture-token");
    expect(unseal(sealed)).toEqual({ token: "fixture-token" });
    expect(unseal(sealed.slice(0, -4))).toBeNull();
    vi.stubEnv("SESSION_SECRET", "another-fixture-secret");
    expect(unseal(sealed)).toBeNull();
    expect(matchesState("a", "aa")).toBe(false);
  });
  it("requires only a stable session secret and uses PKCE", () => {
    expect(upworkConfigured()).toBe(true);
    const pkce = createPkce();
    expect(pkce.verifier).not.toBe(pkce.challenge);
    expect(pkce.verifier.length).toBeGreaterThan(40);
    vi.stubEnv("SESSION_SECRET", "");
    expect(upworkConfigured()).toBe(false);
  });
  it("dynamically registers a public OAuth client", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ client_id: "dynamic-client" }));
    vi.stubGlobal("fetch", fetch);
    await expect(registerClient(`${origin}/api/upwork/callback`)).resolves.toBe(
      "dynamic-client",
    );
    const request = fetch.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      token_endpoint_auth_method: "none",
    });
  });
  it("explains a rejected hosted callback and does not retry or fall back to localhost", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: "invalid_redirect_uri",
          error_description: "private upstream content",
        },
        { status: 400 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      registerClient("https://fixture.vercel.app/api/upwork/callback"),
    ).rejects.toThrow("Upwork returned invalid_redirect_uri");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([429, 403, 500])(
    "handles registration HTTP %s without exposing upstream content",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response("private upstream content", { status }),
          ),
      );
      await expect(
        registerClient(`${origin}/api/upwork/callback`),
      ).rejects.toThrow(/Upwork/);
    },
  );
  it("rejects a malformed successful registration response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    await expect(
      registerClient(`${origin}/api/upwork/callback`),
    ).rejects.toThrow("invalid MCP registration response");
  });
  it("uses an HTTPS metadata document when Upwork advertises support", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          issuer: "https://mcp.upwork.com",
          client_id_metadata_document_supported: true,
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const hostedOrigin = "https://fixture.vercel.app";
    await expect(
      authorizationClient(`${hostedOrigin}/api/upwork/callback`),
    ).resolves.toBe(`${hostedOrigin}/api/upwork/client-metadata`);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(clientMetadata(hostedOrigin)).toMatchObject({
      client_id: `${hostedOrigin}/api/upwork/client-metadata`,
      redirect_uris: [`${hostedOrigin}/api/upwork/callback`],
      token_endpoint_auth_method: "none",
    });
  });
  it("falls back to registration only when metadata-document support is absent", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ issuer: "https://mcp.upwork.com" }),
      )
      .mockResolvedValueOnce(Response.json({ client_id: "fixture-client" }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      authorizationClient("https://fixture.vercel.app/api/upwork/callback"),
    ).resolves.toBe("fixture-client");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects unexpected authorization metadata issuers", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          issuer: "https://invalid.example",
          client_id_metadata_document_supported: true,
        }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      authorizationClient("https://fixture.vercel.app/api/upwork/callback"),
    ).rejects.toThrow("invalid sign-in capabilities");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("starts authorization with a private expiring PKCE state cookie", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ client_id: "dynamic-client" })),
    );
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
    expect(authorize.searchParams.get("client_id")).toBe("dynamic-client");
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorize.searchParams.has("client_secret")).toBe(false);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("rejects callback state mismatch without exchanging a token", async () => {
    jar.get.mockReturnValue({
      value: seal({
        state: "expected",
        redirectUri: `${origin}/api/upwork/callback`,
        clientId: "dynamic-client",
        verifier: "verifier",
        expiresAt: Date.now() + 10_000,
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
  it("returns an actionable expired-link error without exchanging credentials", async () => {
    jar.get.mockReturnValue({
      value: seal({
        state: "expected",
        redirectUri: `${origin}/api/upwork/callback`,
        clientId: "test-client",
        verifier: "test-verifier",
        expiresAt: Date.now() - 1,
      }),
    });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await finishLogin(
      new Request(`${origin}/api/upwork/callback?code=fixture&state=expected`, {
        headers: { host: "127.0.0.1:8765" },
      }),
    );
    expect(response.headers.get("location")).toContain("connection=expired");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("refuses login requests from another origin before client registration", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await startLogin(
      new Request(`${origin}/api/upwork/login`, {
        method: "POST",
        headers: { host: "127.0.0.1:8765", origin: "https://example.invalid" },
      }),
    );
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("creates an Upwork session only after a PKCE token exchange", async () => {
    jar.get.mockReturnValue({
      value: seal({
        state: "expected",
        redirectUri: `${origin}/api/upwork/callback`,
        clientId: "dynamic-client",
        verifier: "verifier",
        expiresAt: Date.now() + 10_000,
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
  });
  it("binds MCP access tokens to a session", async () => {
    jar.get.mockReturnValue({
      value: seal({
        accessToken: "fixture-access",
        sessionId: "one",
        expiresAt: Date.now() + 10_000,
      }),
    });
    await expect(
      accessToken({
        mode: "upwork",
        id: "one",
        expiresAt: Date.now() + 10_000,
      }),
    ).resolves.toBe("fixture-access");
    await expect(
      accessToken({
        mode: "upwork",
        id: "two",
        expiresAt: Date.now() + 10_000,
      }),
    ).resolves.toBeNull();
  });
  it("sends the dynamic client and verifier during token exchange", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ access_token: "fixture-access", expires_in: 3600 }),
      );
    vi.stubGlobal("fetch", fetch);
    await exchangeCode(
      "fixture",
      `${origin}/api/upwork/callback`,
      "dynamic-client",
      "verifier",
    );
    const body = new URLSearchParams(
      (fetch.mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body.get("client_id")).toBe("dynamic-client");
    expect(body.get("code_verifier")).toBe("verifier");
    expect(body.has("client_secret")).toBe(false);
  });
});

describe("job import", () => {
  it("accepts current Upwork job links and rejects arbitrary destinations", () => {
    expect(jobIdFromUrl(jobUrl)).toBe(jobUrl);
    for (const url of [
      "http://127.0.0.1/private",
      "https://upwork.com.evil.test/jobs/x_~022056488576136638272/",
      "https://user:pass@www.upwork.com/jobs/x_~022056488576136638272/",
      "https://www.upwork.com/jobs/x_~01abcdef/",
    ])
      expect(() => jobIdFromUrl(url)).toThrow();
  });
});

describe("Vercel origins", () => {
  it("accepts exact platform domains while rejecting other hosts and cross-origin writes", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_URL", "fixture-preview.vercel.app");
    const request = (host: string, requestOrigin: string) =>
      new Request(`https://${host}/api/session`, {
        method: "POST",
        headers: { host, origin: requestOrigin },
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
  });
});
