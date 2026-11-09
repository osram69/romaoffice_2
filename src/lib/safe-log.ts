// Logging that cannot leak secrets. Drizzle's DrizzleQueryError puts the whole SQL and its parameters in `message`
// ("Failed query: ... params: ..."), and a failed write on staff_users carries the password hash and the username.
// So an error is never logged as an object and its message, query, params and stack are never read: only the
// error class name and, when there is one, the 5-character PostgreSQL SQLSTATE.

const SQLSTATE = /^[0-9A-Z]{5}$/;
const SAFE_NAME = /^[A-Za-z0-9_]{1,40}$/;

function sqlState(error: unknown): string | null {
  for (let current: unknown = error, depth = 0; current && typeof current === "object" && depth < 3; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && SQLSTATE.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export function logSafeError(label: string, error: unknown): void {
  const name = error instanceof Error && SAFE_NAME.test(error.name) ? error.name : "UnknownError";
  const code = error instanceof Error ? sqlState(error) : null;
  console.error(code ? `${label} (${name}, SQLSTATE ${code})` : `${label} (${name})`);
}
