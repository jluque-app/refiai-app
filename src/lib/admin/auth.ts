/**
 * Lightweight admin gate for the teacher dashboard.
 *
 * v1: a single shared password compared against the ADMIN_PASSWORD env var,
 * sent by the dashboard in an `x-admin-key` header. This is intentionally
 * simple so it ships today; before going to production replace with real auth
 * (per-teacher accounts, sessions/JWT, or an auth provider).
 */
const DEFAULT_DEV_PASSWORD = "refiai-admin";

export function expectedPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_DEV_PASSWORD;
}

export function isAdmin(req: Request): boolean {
  const key = req.headers.get("x-admin-key") || "";
  return key.length > 0 && key === expectedPassword();
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
