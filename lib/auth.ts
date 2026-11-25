// Password gate. The cookie holds an HMAC keyed by DASHBOARD_PASSWORD, so it can't be forged without knowing the password.
export const COOKIE = "voiant_dash";

async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function sessionToken(): Promise<string> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) throw new Error("DASHBOARD_PASSWORD is not set");
  return hmac(pw, "voiant-dashboard-session-v1");
}

export async function validSession(value: string | undefined): Promise<boolean> {
  if (!value || !process.env.DASHBOARD_PASSWORD) return false;
  return same(value, await sessionToken());
}

export async function passwordMatches(attempt: string): Promise<boolean> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return false;
  // Compare hashes so length doesn't leak.
  return same(await hmac("cmp", attempt), await hmac("cmp", pw));
}

// Expiring share link: /s/<expiry in ms>.<signature>. The signature is an HMAC keyed by DASHBOARD_PASSWORD, so links can't be forged
// or extended, and changing the password cancels every link at once.
export const SHARE_COOKIE = "voiant_share";

export async function shareSignature(exp: string): Promise<string> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) throw new Error("DASHBOARD_PASSWORD is not set");
  return hmac(pw, `voiant-share-v1:${exp}`);
}

// Returns the expiry (ms since 1970) when the token is genuine and not expired, otherwise null.
export async function shareExpiry(token: string | undefined): Promise<number | null> {
  if (!token || !process.env.DASHBOARD_PASSWORD) return null;
  const [exp, sig] = token.split(".");
  if (!/^\d{10,15}$/.test(exp ?? "") || !sig) return null;
  if (!same(sig, await shareSignature(exp))) return null;
  const ms = Number(exp);
  return ms > Date.now() ? ms : null;
}
