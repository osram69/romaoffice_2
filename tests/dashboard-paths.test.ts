import test from "node:test";
import assert from "node:assert/strict";
import { DASHBOARD_PATH_PREFIXES, isDashboardPath } from "@/lib/dashboard-paths";

test("every dashboard area, old and new, renders without the public site chrome", () => {
  for (const prefix of DASHBOARD_PATH_PREFIXES) {
    assert.equal(isDashboardPath(prefix), true, prefix);
    assert.equal(isDashboardPath(`${prefix}/impostazioni`), true, `${prefix}/impostazioni`);
  }
  for (const path of [
    "/gestione-contabilita-x9k2m7", "/gestione-contabilita-x9k2m7/impostazioni", "/gestione-utenti-x9k2m7",
    "/gestione-password-x9k2m7", "/commercialista-x9k2m7", "/gestione-tariffe-x9k2m7/login",
  ]) assert.equal(isDashboardPath(path), true, path);
});

test("public pages keep header, footer and cookie banner", () => {
  for (const path of ["/", "/contatti.html", "/en/contact.html", "/area-clienti.html", "/tariffe.html", "/gestione.html", "/commercialista"]) {
    assert.equal(isDashboardPath(path), false, path);
  }
});

test("lookalike paths are not treated as dashboard pages", () => {
  assert.equal(isDashboardPath("/gestione-contabilita-x9k2m7evil"), false);
  assert.equal(isDashboardPath("/x/gestione-contabilita-x9k2m7"), false);
});
