import test from "node:test";
import assert from "node:assert/strict";
import { buildResetSql, sqlQuote } from "../scripts/staff-password-sql";

test("sqlQuote doubles single quotes so a value cannot end the literal", () => {
  assert.equal(sqlQuote("abc"), "'abc'");
  assert.equal(sqlQuote("o'brien"), "'o''brien'");
  assert.equal(sqlQuote("x'; DROP TABLE staff_users; --"), "'x''; DROP TABLE staff_users; --'");
});

test("buildResetSql returns the update and the session deletion, both with the quoted username", () => {
  const [update, deleteSessions, ...rest] = buildResetSql("zz-test-user", "hash$with'quote");
  assert.equal(rest.length, 0);
  assert.equal(update, "UPDATE staff_users SET password_hash = 'hash$with''quote', active = true WHERE username = 'zz-test-user';");
  assert.equal(deleteSessions, "DELETE FROM staff_sessions WHERE user_id = (SELECT id FROM staff_users WHERE username = 'zz-test-user');");
});

test("buildResetSql quotes a hostile username in both statements", () => {
  for (const statement of buildResetSql("a'b", "h")) assert.ok(statement.includes("'a''b'"), statement);
});

test("buildResetSql never sets must_change_password", () => {
  for (const statement of buildResetSql("u", "h")) assert.ok(!/must_change_password/.test(statement));
});
