import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/server/origin";
import { assertOrigin } from "@/lib/server/session";
import { AppError, errorResponse } from "@/lib/server/errors";
import {
  OAUTH_COOKIE,
  createPkce,
  registerClient,
  seal,
  upworkConfigured,
} from "@/lib/server/upwork/connection";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (!upworkConfigured())
      throw new AppError(
        503,
        "Set a stable SESSION_SECRET before connecting Upwork.",
      );
    const origin = requestOrigin(request).origin;
    const redirectUri = `${origin}/api/upwork/callback`;
    const clientId = await registerClient(redirectUri);
    const pkce = createPkce(),
      state = crypto.randomUUID();
    const authorize = new URL(
      "https://www.upwork.com/ab/account-security/oauth2/authorize",
    );
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      resource: "https://mcp.upwork.com/mcp",
    }).toString();
    const response = NextResponse.json(
      { url: authorize.href },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(
      OAUTH_COOKIE,
      seal({
        state,
        redirectUri,
        clientId,
        verifier: pkce.verifier,
        expiresAt: Date.now() + 600_000,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: origin.startsWith("https:"),
        path: "/api/upwork",
        maxAge: 600,
      },
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
