import { integrationErrorMessage } from "@/server/integration-error";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  exchangeMicrosoftCode,
  parseMicrosoftOAuthState,
} from "@/server/microsoft-email";

export const dynamic = "force-dynamic";

function equalToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function redirectWith(req: NextRequest, key: string, value: string): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/dashboard/integrations?${key}=${encodeURIComponent(value)}`, req.url),
  );
  response.cookies.set("tidetime_ms_oauth_state", "", {
    httpOnly: true,
    path: "/api/microsoft-email/callback",
    maxAge: 0,
  });
  response.cookies.set("tidetime_ms_oauth_verifier", "", {
    httpOnly: true,
    path: "/api/microsoft-email/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) return redirectWith(req, "microsoft_error", "Administrator session required");

  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("tidetime_ms_oauth_state")?.value;
  const stateUserId = state ? parseMicrosoftOAuthState(state) : null;
  if (
    !state ||
    !expectedState ||
    !equalToken(state, expectedState) ||
    stateUserId !== user.id
  ) {
    return redirectWith(req, "microsoft_error", "Invalid or expired Microsoft connection request");
  }

  const error = req.nextUrl.searchParams.get("error");
  if (error) {
    return redirectWith(
      req,
      "microsoft_error",
      req.nextUrl.searchParams.get("error_description") || error,
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const codeVerifier = req.cookies.get("tidetime_ms_oauth_verifier")?.value;
  if (!code || !codeVerifier) {
    return redirectWith(req, "microsoft_error", "Microsoft returned an incomplete authorization response");
  }

  try {
    await exchangeMicrosoftCode(code, codeVerifier);
    return redirectWith(req, "microsoft_connected", "1");
  } catch (error) {
    return redirectWith(
      req,
      "microsoft_error",
      integrationErrorMessage(error, "Microsoft connection failed"),
    );
  }
}
