import "server-only";
import type { Sql } from "postgres";

// Shared LinkedIn OAuth helpers used by the connect/callback routes and the ads sync.
// Needs LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI.
const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
export const SCOPES = "r_ads r_ads_reporting";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env("LINKEDIN_CLIENT_ID"),
    redirect_uri: env("LINKEDIN_REDIRECT_URI"),
    state,
    scope: SCOPES,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; refresh_token_expires_in?: number; scope?: string };

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`LinkedIn token endpoint returned ${r.status}: ${await r.text()}`);
  return (await r.json()) as TokenResponse;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  return requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: env("LINKEDIN_REDIRECT_URI"),
    client_id: env("LINKEDIN_CLIENT_ID"),
    client_secret: env("LINKEDIN_CLIENT_SECRET"),
  });
}

async function refreshToken(refresh_token: string): Promise<TokenResponse> {
  return requestToken({
    grant_type: "refresh_token",
    refresh_token,
    client_id: env("LINKEDIN_CLIENT_ID"),
    client_secret: env("LINKEDIN_CLIENT_SECRET"),
  });
}

export async function saveTokens(sql: Sql, t: TokenResponse): Promise<void> {
  const expires_at = new Date(Date.now() + t.expires_in * 1000).toISOString();
  await sql`
    insert into linkedin_oauth_tokens (id, access_token, refresh_token, expires_at, scope, authorized_at)
    values (1, ${t.access_token}, ${t.refresh_token ?? null}, ${expires_at}, ${t.scope ?? SCOPES}, now())
    on conflict (id) do update set access_token = excluded.access_token, refresh_token = coalesce(excluded.refresh_token, linkedin_oauth_tokens.refresh_token),
      expires_at = excluded.expires_at, scope = excluded.scope, authorized_at = excluded.authorized_at`;
}

// Returns a usable access token, refreshing first if it's within a day of expiring. Throws if nobody has authorized yet,
// or the refresh token itself has expired (back to a manual reauth click).
export async function getAccessToken(sql: Sql): Promise<string> {
  const [row] = await sql<{ access_token: string; refresh_token: string | null; expires_at: string }[]>`
    select access_token, refresh_token, expires_at from linkedin_oauth_tokens where id = 1`;
  if (!row) throw new Error("LinkedIn Ads is not authorized yet. Visit /api/linkedin/connect and sign in once.");
  const soon = Date.now() + 24 * 60 * 60 * 1000;
  if (new Date(row.expires_at).getTime() > soon) return row.access_token;
  if (!row.refresh_token) throw new Error("LinkedIn access token expired and no refresh token is on file. Visit /api/linkedin/connect to reauthorize.");
  try {
    const t = await refreshToken(row.refresh_token);
    await saveTokens(sql, t);
    return t.access_token;
  } catch (e) {
    throw new Error(`LinkedIn token refresh failed (${e instanceof Error ? e.message : "unknown error"}); reauthorize at /api/linkedin/connect.`);
  }
}
