import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTAB_UNLOCK_SECONDS } from "@/lib/contab-auth";
import { PASSWORD_MAX_LENGTH } from "@/lib/password-policy";
import { STAFF_SESSION_SECONDS } from "@/lib/staff-auth";
import { contabUnlockCookieOptions } from "@/app/gestione-contabilita-x9k2m7/cookie";
import {
  parseCreateSectionInput,
  parseDirection,
  parseNewPasswordInput,
  parsePasswordChangeInput,
  parseRenameSectionInput,
  parseRowId,
  parseUnlockInput,
} from "@/app/gestione-contabilita-x9k2m7/parse";

const DIR = "src/app/gestione-contabilita-x9k2m7";
const STRONG = "Zz-test-Passw0rd-ok!";

function form(fields: Record<string, string | Blob>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  return fd;
}

// ---- parse.ts ----

test("parseRowId accepts positive safe integers and digit strings only", () => {
  assert.equal(parseRowId(5), 5);
  assert.equal(parseRowId("12"), 12);
  assert.equal(parseRowId(2147483647), 2147483647);
  for (const bad of [0, -1, 1.5, NaN, Infinity, 2147483648, "0", "-3", "1e3", "12abc", "", " 4", null, undefined, {}, [], true, 2 ** 60]) {
    assert.equal(parseRowId(bad), null, JSON.stringify(bad));
  }
});

test("parseDirection accepts up and down only", () => {
  assert.equal(parseDirection("up"), "up");
  assert.equal(parseDirection("down"), "down");
  for (const bad of ["UP", "left", "", null, undefined, 1, {}]) assert.equal(parseDirection(bad), null);
});

test("parseCreateSectionInput trims and validates the title with the shared rules", () => {
  assert.deepEqual(parseCreateSectionInput(form({ title: "  1° trimestre 2026 " })), { ok: true, title: "1° trimestre 2026" });
  for (const title of ["", "   ", "x".repeat(101), "x".repeat(5000)]) {
    const r = parseCreateSectionInput(form({ title }));
    assert.equal(r.ok, false, title.slice(0, 10));
    if (!r.ok) assert.match(r.message, /da 1 a 100 caratteri/);
  }
  assert.equal(parseCreateSectionInput(form({})).ok, false);
  assert.equal(parseCreateSectionInput(form({ title: new Blob(["x"]) })).ok, false);
  assert.equal(parseCreateSectionInput(form({ title: "x".repeat(100) })).ok, true);
});

test("parseRenameSectionInput needs a valid section id and a valid title", () => {
  assert.deepEqual(parseRenameSectionInput(form({ sectionId: "3", title: " Fatture " })), { ok: true, sectionId: 3, title: "Fatture" });
  assert.equal(parseRenameSectionInput(form({ sectionId: "abc", title: "Fatture" })).ok, false);
  assert.equal(parseRenameSectionInput(form({ title: "Fatture" })).ok, false);
  assert.equal(parseRenameSectionInput(form({ sectionId: "3", title: "" })).ok, false);
});

test("parseUnlockInput needs a non-empty string password and does not alter it", () => {
  assert.deepEqual(parseUnlockInput(form({ password: " ab c " })), { ok: true, password: " ab c " });
  assert.equal(parseUnlockInput(form({ password: "" })).ok, false);
  assert.equal(parseUnlockInput(form({})).ok, false);
  assert.equal(parseUnlockInput(form({ password: new Blob(["x"]) })).ok, false);
});

test("parseNewPasswordInput: both fields, caps, policy and confirmation", () => {
  assert.deepEqual(parseNewPasswordInput(form({ next: STRONG, confirm: STRONG })), { ok: true, password: STRONG });
  assert.equal(parseNewPasswordInput(form({ next: STRONG, confirm: STRONG + "x" })).ok, false);
  assert.equal(parseNewPasswordInput(form({ next: "debole", confirm: "debole" })).ok, false);
  assert.equal(parseNewPasswordInput(form({ next: STRONG })).ok, false);
  const long = "Aa1!".repeat(PASSWORD_MAX_LENGTH);
  assert.equal(parseNewPasswordInput(form({ next: long, confirm: long })).ok, false);
});

test("parsePasswordChangeInput passes the three values through and rejects missing or non-string ones", () => {
  assert.deepEqual(parsePasswordChangeInput(form({ current: "a", next: "b", confirm: "c" })), { ok: true, current: "a", next: "b", confirm: "c" });
  assert.equal(parsePasswordChangeInput(form({ current: "a", next: "b" })).ok, false);
  assert.equal(parsePasswordChangeInput(form({ current: new Blob(["x"]), next: "b", confirm: "c" })).ok, false);
});

// ---- the unlock cookie ----

test("contabUnlockCookieOptions: httpOnly, strict, path /, lifetime of the staff session (server-side expiry slides), secure only in production", () => {
  assert.deepEqual(contabUnlockCookieOptions("production"), { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: STAFF_SESSION_SECONDS });
  assert.deepEqual(contabUnlockCookieOptions("development"), { httpOnly: true, secure: false, sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
  // The cookie must outlive the 30-minute inactivity window, otherwise active use would drop it.
  assert.ok(contabUnlockCookieOptions("production").maxAge > CONTAB_UNLOCK_SECONDS);
  assert.equal(contabUnlockCookieOptions(undefined).secure, false);
  assert.equal(contabUnlockCookieOptions("test").secure, false);
});

// ---- actions.ts structure (an action needs a request context, so the guard order is checked on the source) ----

const actionsSource = readFileSync(`${DIR}/actions.ts`, "utf8");
const exportLines = [...actionsSource.matchAll(/^export\s+(.*)$/gm)].map(m => m[1]);
const actionBodies = actionsSource.split(/^export async function /m).slice(1);
const EXEMPT = ["unlockContabAction", "setInitialContabPasswordAction"];

test("actions.ts: a use-server file whose every export is an async function", () => {
  assert.match(actionsSource, /^"use server";/);
  assert.equal(exportLines.length, 8);
  for (const line of exportLines) assert.match(line, /^async function \w+\(/, line);
  assert.equal(actionBodies.length, exportLines.length);
  const names = exportLines.map(line => /^async function (\w+)\(/.exec(line)![1]).sort();
  assert.deepEqual(names, [
    "changeContabPasswordAction",
    "createSectionAction",
    "deleteContabFileAction",
    "deleteSectionAction",
    "moveSectionAction",
    "renameSectionAction",
    "setInitialContabPasswordAction",
    "unlockContabAction",
  ]);
});

test("actions.ts: every action starts with requireAdminUser, outside any try", () => {
  for (const body of actionBodies) {
    const afterBrace = body.slice(body.indexOf("{") + 1).trimStart();
    assert.match(afterBrace, /^(const admin = )?await requireAdminUser\(BASE_PATH\);/, body.slice(0, 60));
  }
  // No try block opens before the guard in any action.
  for (const body of actionBodies) {
    assert.ok(body.indexOf("requireAdminUser(BASE_PATH)") < (body.indexOf("try {") === -1 ? Infinity : body.indexOf("try {")));
  }
});

test("actions.ts: all but unlock and the initial password check the unlock right after the admin guard", () => {
  for (const body of actionBodies) {
    const name = /^(\w+)\(/.exec(body)![1];
    const afterGuard = body.slice(body.indexOf("requireAdminUser(BASE_PATH);") + "requireAdminUser(BASE_PATH);".length).trimStart();
    if (EXEMPT.includes(name)) {
      assert.doesNotMatch(afterGuard.slice(0, 120), /contabAccessFromCookies/, name);
    } else {
      assert.match(afterGuard, /^const unlocked = await contabAccessFromCookies\(\);\s*if \(!unlocked\) return LOCKED;/, name);
    }
  }
  assert.match(actionsSource, /const LOCKED = \{ ok: false, message: CONTAB_LOCKED_MESSAGE \}/);
  assert.match(readFileSync("src/lib/contab-messages.ts", "utf8"), /"Sblocco scaduto, reinserisci la password"/);
});

test("actions.ts: the initial password is set only after the admin guard and the unlock cookie uses the shared options", () => {
  const initial = actionBodies.find(b => b.startsWith("setInitialContabPasswordAction("))!;
  assert.ok(initial.indexOf("requireAdminUser(BASE_PATH)") < initial.indexOf("setInitialContabPassword("));
  // The only call site of the library function is inside that action.
  assert.equal([...actionsSource.matchAll(/\bsetInitialContabPassword\(/g)].length, 1);
  assert.match(actionsSource, /store\.set\(CONTAB_UNLOCK_COOKIE, \w+(\.\w+)?, contabUnlockCookieOptions\(process\.env\.NODE_ENV\)\)/);
  // The unlock action reads the staff session cookie itself and passes it to unlockContab.
  assert.match(actionsSource, /store\.get\(STAFF_SESSION_COOKIE\)\?\.value/);
  assert.match(actionsSource, /unlockContab\(\w+, \w+, \w+\)/);
});

test("actions.ts: the second-password change is rate limited, keeps only the caller's session and never logs input", () => {
  const change = readFileSync(`${DIR}/change.ts`, "utf8");
  assert.match(change, /limit\("contab-pw-change:" \+ user\.id, 5, 900\)/);
  assert.match(change, /changeContabPassword\(input\.current, input\.next, rawSession\)/);
  assert.match(change, /validatePasswordChange\(/);
  const body = actionBodies.find(b => b.startsWith("changeContabPasswordAction("))!;
  assert.match(body, /performContabPasswordChange\(/);
  assert.match(body, /\.get\(STAFF_SESSION_COOKIE\)\?\.value/);
  for (const [file, source] of [["actions.ts", actionsSource], ["change.ts", change]] as const) {
    const withoutStrings = source.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    assert.doesNotMatch(withoutStrings, /console\.\w+\(/, file);
    assert.match(source, /logSafeError\("/, file);
  }
});

test("actions.ts: storedName stays on the server (only used to remove the file) and changes revalidate the pages", () => {
  // The deleted row is used only to remove the encrypted file; no action returns it.
  assert.doesNotMatch(actionsSource, /return[^;\n]*storedName/);
  assert.match(actionsSource, /revalidatePath\(BASE_PATH\)/);
  assert.match(actionsSource, /revalidatePath\(`\$\{BASE_PATH\}\/impostazioni`\)/);
});

// ---- pages ----

test("layout is noindex and imports the dashboard css", () => {
  const layout = readFileSync(`${DIR}/layout.tsx`, "utf8");
  assert.match(layout, /robots: \{ index: false, follow: false \}/);
  assert.match(layout, /import "\.\.\/gestione\.css";/);
});

test("page.tsx: admin guard first, and no section or file data is read before the unlock check has passed", () => {
  const page = readFileSync(`${DIR}/page.tsx`, "utf8");
  const at = (needle: string) => page.indexOf(needle);
  const guard = at("await requireAdminUser(BASE_PATH)");
  const hasPassword = at("await hasContabPassword()");
  const unlock = at("await contabAccessFromCookies()");
  const list = at("await listSectionsWithFiles()");
  assert.ok(guard > -1 && hasPassword > guard && unlock > hasPassword && list > unlock, "order: guard, password exists, unlock, data");
  // The locked and the no-password states return before the data call.
  const locked = /if \(!unlocked\) \{?\s*return/.exec(page);
  assert.ok(locked && locked.index > unlock && locked.index < list);
  const noPassword = /if \(!\(await hasContabPassword\(\)\)\) \{?\s*return/.exec(page);
  assert.ok(noPassword && noPassword.index < unlock);
  // The data call appears exactly once and nothing else of contab-data is used by the page.
  assert.equal([...page.matchAll(/listSectionsWithFiles\(/g)].length, 1);
  assert.match(page, /toContabSectionDto/);
  assert.doesNotMatch(page, /storedName/);
  assert.doesNotMatch(page, /force-static|revalidate\s*=|dynamic\s*=/);
  assert.match(page, /GestioneShell[^>]*active="contabilita"/);
});

test("impostazioni/page.tsx: admin first, then the unlock check, then data; locked or without password goes back to the main page", () => {
  const page = readFileSync(`${DIR}/impostazioni/page.tsx`, "utf8");
  const at = (needle: string) => page.indexOf(needle);
  const guard = at("await requireAdminUser(BASE_PATH)");
  const hasPassword = at("await hasContabPassword()");
  const unlock = at("await contabAccessFromCookies()");
  const list = at("await listSectionsWithFiles()");
  assert.ok(guard > -1 && hasPassword > guard && unlock > hasPassword && list > unlock);
  assert.match(page, /if \(!unlocked\) redirect\(MAIN_PATH\)/);
  assert.match(page, /\/gestione-utenti-x9k2m7/);
  assert.match(page, /toContabSettingsSectionDto/);
  assert.doesNotMatch(page, /storedName/);
  assert.doesNotMatch(page, /force-static|revalidate\s*=|dynamic\s*=/);
});

test("no component or page of the accounting area mentions storedName", () => {
  for (const file of [
    "src/components/ContabUploadRow.tsx",
    "src/components/ContabUnlockForm.tsx",
    "src/components/ContabDeleteFileButton.tsx",
    "src/components/ContabSectionsAdmin.tsx",
    "src/components/ContabPasswordForm.tsx",
    "src/lib/contab-dto.ts",
  ]) {
    assert.doesNotMatch(readFileSync(file, "utf8").replace(/\/\/.*$/gm, ""), /storedName/, file);
  }
});
