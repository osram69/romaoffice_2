import { CONTAB_UNLOCK_SECONDS } from "@/lib/contab-auth";

/** Options of the `ros_contab_unlock` cookie: not readable by scripts, never sent cross-site, secure in production, 30 minutes. */
export function contabUnlockCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: CONTAB_UNLOCK_SECONDS,
  };
}
