// Pure helpers of reset-staff-password.ts, kept apart so they can be tested without a database.

/** SQL string literal: single quotes are doubled, so a value can never end the literal early. */
export function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** The statements to paste into the Supabase SQL editor: the password update and the end of the user's open sessions. */
export function buildResetSql(username: string, passwordHash: string): string[] {
  const user = sqlQuote(username);
  return [
    `UPDATE staff_users SET password_hash = ${sqlQuote(passwordHash)}, active = true WHERE username = ${user};`,
    `DELETE FROM staff_sessions WHERE user_id = (SELECT id FROM staff_users WHERE username = ${user});`,
  ];
}
