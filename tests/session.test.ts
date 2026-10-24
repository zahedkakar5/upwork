import { describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import {
  assertOrigin,
  issueSession,
  verifySession,
  csrfForSession,
} from "../src/lib/server/session";
describe("local preview sessions", () => {
  it("rejects tampered, expired and missing cookies", () => {
    const token = issueSession(1000);
    expect(verifySession(token, 1001)?.mode).toBe("preview");
    expect(verifySession(token + "x", 1001)).toBeNull();
    expect(verifySession(token, 1000 + 13 * 60 * 60 * 1000)).toBeNull();
    expect(verifySession(undefined)).toBeNull();
  });
  it("binds CSRF tokens to a session", () => {
    const first = verifySession(issueSession())!,
      second = verifySession(issueSession())!;
    expect(csrfForSession(first)).not.toBe(csrfForSession(second));
  });
  it("rejects cross-origin writes and unexpected Host headers", () => {
    expect(() =>
      assertOrigin(
        new Request("http://127.0.0.1:8765/api/profile", {
          method: "POST",
          headers: { host: "127.0.0.1:8765", origin: "https://example.com" },
        }),
      ),
    ).toThrow();
    expect(() =>
      assertOrigin(
        new Request("http://evil.test/api/profile", {
          headers: { host: "evil.test" },
        }),
      ),
    ).toThrow();
    expect(() =>
      assertOrigin(
        new Request("http://127.0.0.1:8765/api/profile", {
          method: "POST",
          headers: { host: "127.0.0.1:8765", origin: "http://127.0.0.1:8765" },
        }),
      ),
    ).not.toThrow();
  });
  it("accepts Next.js-normalized loopback URLs while checking the original Host", () => {
    expect(() =>
      assertOrigin(
        new Request("http://localhost:8765/api/profile", {
          method: "POST",
          headers: { host: "127.0.0.1:8765", origin: "http://127.0.0.1:8765" },
        }),
      ),
    ).not.toThrow();
  });
});
