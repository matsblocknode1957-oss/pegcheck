// Shared admin-auth helpers.
// Uses only atob + TextEncoder — safe in both Edge Runtime (middleware)
// and Node.js runtime (API routes). No Buffer, no Node crypto.

const REALM = "FintechCheck Admin";
export const ADMIN_WWW_AUTH = `Basic realm="${REALM}"`;

/** Extracts the password from an Authorization: Basic base64(user:pass) header. */
export function extractBasicPassword(header: string | null): string | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const colon   = decoded.indexOf(":");
    return colon === -1 ? decoded : decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

/** Constant-time string comparison — no early exit on mismatch or length diff. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc  = new TextEncoder();
  const ab   = enc.encode(a);
  const bb   = enc.encode(b);
  const len  = Math.max(ab.length, bb.length);
  let   diff = ab.length === bb.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/** Returns null if the request is authorised, or { status, headers } to return immediately. */
export function checkAdminAuth(authHeader: string | null): { status: 401; headers: Record<string, string>; error: string } | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return { status: 401, headers: { "WWW-Authenticate": ADMIN_WWW_AUTH }, error: "Admin access is not configured" };
  }
  const submitted = extractBasicPassword(authHeader);
  if (!submitted || !timingSafeEqual(submitted, password)) {
    return { status: 401, headers: { "WWW-Authenticate": ADMIN_WWW_AUTH }, error: "Unauthorized" };
  }
  return null;
}
