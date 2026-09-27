import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase-admin";
import { canonical } from "@/lib/vertical-canonical";
import { isOwnerSessionRevoked, withoutOwnerSecrets } from "@/lib/owner-session-guard";

// Owner-token cookie auth (TDL #624 — ported from doineedanaccountant lib/auth.ts).
// Cookie value is `${slug}:${token}`; the token is the listing's owner_auth_token.
const COOKIE_NAME = `${canonical.tablePrefix}owner_token`; // mortgage_owner_token
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function generateToken(): string {
  return randomUUID();
}

export function setAuthCookie(
  response: NextResponse,
  token: string,
  slug: string
): void {
  response.cookies.set(COOKIE_NAME, `${slug}:${token}`, {
    httpOnly: true,
    maxAge: MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function getAuthFromCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>
): { slug: string; token: string } | null {
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  const separatorIndex = cookie.value.indexOf(":");
  if (separatorIndex === -1) return null;
  const slug = cookie.value.substring(0, separatorIndex);
  const token = cookie.value.substring(separatorIndex + 1);
  if (!slug || !token) return null;
  return { slug, token };
}

// owner-auth-hardening-and-edit-log-v1: THE cookie gate for owner routes that match the token
// themselves. getAuthFromCookies only parses the cookie; this also refuses a session revoked
// server-side (owner_session_meta.revoked_at). Protected owner routes use this, never the parser.
export async function getActiveOwnerAuth(
  cookieStore: Awaited<ReturnType<typeof cookies>>
): Promise<{ slug: string; token: string } | null> {
  const auth = getAuthFromCookies(cookieStore);
  if (!auth) return null;
  if (await isOwnerSessionRevoked(auth.token, auth.slug)) return null;
  return auth;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function verifyOwnerAccess(slug: string): Promise<{ listing: any } | null> {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);
  if (!auth) return null;
  if (auth.slug !== slug) return null;

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*")
    .eq("slug", slug)
    .eq("owner_auth_token", auth.token)
    .single();

  if (error || !listing) return null;
  // owner-auth-hardening: a server-side-revoked session is refused on every owner surface.
  if (await isOwnerSessionRevoked(auth.token, slug)) return null;
  return { listing: withoutOwnerSecrets(listing) };
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
