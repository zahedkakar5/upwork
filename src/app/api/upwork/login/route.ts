import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { assertOrigin } from "@/lib/server/session";
import { requestOrigin } from "@/lib/server/origin";
import { readJson } from "@/lib/server/http";
import { errorResponse, AppError } from "@/lib/server/errors";
import {
  OAUTH_COOKIE,
  seal,
  upworkConfigured,
} from "@/lib/server/upwork/connection";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await readJson(request, 128);
    if (!upworkConfigured())
      throw new AppError(
        503,
        "Upwork login needs an approved UPWORK_CLIENT_ID, UPWORK_CLIENT_SECRET and stable SESSION_SECRET on the server.",
      );
    const origin = requestOrigin(request).origin;
    const state = randomBytes(32).toString("base64url");
    const redirectUri = `${origin}/api/upwork/callback`;
    const authorize = new URL(
      "https://www.upwork.com/ab/account-security/oauth2/authorize",
    );
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: process.env.UPWORK_CLIENT_ID!,
      redirect_uri: redirectUri,
      state,
    }).toString();
    const response = NextResponse.json(
      { url: authorize.href },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(
      OAUTH_COOKIE,
      seal({ state, redirectUri, expiresAt: Date.now() + 600_000 }),
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
