import { STAFF_SESSION_SECONDS } from "@/lib/staff-auth";

/**
 * Options of the `ros_contab_unlock` cookie: not readable by scripts, never sent cross-site, secure in production.
 * The browser keeps it as long as the staff session (it is only a bearer of the token). The real 30-minute inactivity
 * limit is the server-side `expires_at` of the unlock, which slides on every use: a fixed 30-minute cookie lifetime
 * would drop the cookie after 30 minutes of active use and break that sliding window.
 */
export function contabUnlockCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: STAFF_SESSION_SECONDS,
  };
}
