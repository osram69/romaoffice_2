import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CommercialistaDocuments } from "@/components/CommercialistaDocuments";
import type { ContabSectionDto } from "@/lib/contab-dto";

// Pure tests: no database, no request. The page itself is checked as source text, the document list is rendered.
const DIR = "src/app/commercialista-x9k2m7";
const pageSource = readFileSync(`${DIR}/page.tsx`, "utf8");
const layoutSource = readFileSync(`${DIR}/layout.tsx`, "utf8");
const componentSource = readFileSync("src/components/CommercialistaDocuments.tsx", "utf8");

// Comments may mention forbidden words ("storedName"); only the code counts.
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function render(sections: ContabSectionDto[]): string {
  return renderToStaticMarkup(createElement(CommercialistaDocuments, { sections }));
}

const file = (id: number, name: string, over: Partial<ContabSectionDto["files"][number]> = {}) => ({
  id,
  originalName: name,
  sizeBytes: 440402,
  uploadedAt: "2026-11-06T09:30:00.000Z",
  lastDownloadAt: null,
  ...over,
});

// ---- page and layout, as source ----

test("page: requireCommercialista is the first awaited statement, before any data is read", () => {
  const body = code(pageSource);
  const awaits = [...body.matchAll(/await\s+([A-Za-z_]+)/g)].map(m => m[1]);
  assert.equal(awaits[0], "requireCommercialista");
  assert.equal(awaits[1], "listSectionsWithFiles");
  assert.ok(body.indexOf("await requireCommercialista()") < body.indexOf("listSectionsWithFiles("));
  assert.match(body, /toContabSectionDto/);
  assert.equal([...body.matchAll(/requireCommercialista\(/g)].length, 1);
});

test("page: no admin shell, no storedName, no upload, no other links to the dashboard", () => {
  for (const src of [pageSource, componentSource]) {
    const body = code(src);
    assert.doesNotMatch(body, /GestioneShell|GestioneNav|GestioneSidebar/);
    assert.doesNotMatch(body, /storedName|stored_name/);
    assert.doesNotMatch(body, /type=["']file["']/);
    assert.doesNotMatch(body, /["'`]use client["'`]/);
    assert.doesNotMatch(body, /gestione-(domiciliazioni|ordini|tariffe|configurazione|contabilita|utenti)-x9k2m7/);
    assert.doesNotMatch(body, /Impostazioni|\bCarica\b|Elimina|Rinomina/);
  }
});

test("page: the only form is the logout one, bound to staffLogoutAction", () => {
  const forms = [...code(pageSource).matchAll(/<form\b[^>]*>/g)].map(m => m[0]);
  assert.equal(forms.length, 1);
  assert.match(forms[0], /action=\{staffLogoutAction\}/);
  assert.doesNotMatch(code(componentSource), /<form\b|<input\b|<button\b/);
});

test("page: header text and the password link", () => {
  const body = code(pageSource);
  assert.match(body, /Documentazione contabile/);
  assert.match(body, /Cambia password/);
  assert.match(body, /Esci/);
  assert.match(body, /PASSWORD_CHANGE_PATH|\/gestione-password-x9k2m7/);
  assert.match(body, /BrandWords/);
});

test("layout: noindex, same css as the other dashboard areas, rendered on every request", () => {
  assert.match(layoutSource, /robots: \{ index: false, follow: false \}/);
  assert.match(layoutSource, /import "\.\.\/gestione\.css";/);
  assert.match(layoutSource, /export const dynamic = "force-dynamic";/);
  assert.doesNotMatch(layoutSource, /force-static|revalidate\s*=/);
});

// ---- document list, rendered ----

test("no sections: only the empty message", () => {
  const html = render([]);
  assert.match(html, /Nessun documento disponibile/);
  assert.doesNotMatch(html, /<table|zip/i);
});

test("sections without any file: only the empty message and nothing about the empty sections", () => {
  const html = render([{ id: 1, title: "1° trimestre 2026", files: [] }]);
  assert.match(html, /Nessun documento disponibile/);
  assert.doesNotMatch(html, /trimestre|ZIP|<table/);
});

test("a section with files: title, real table with scope attributes, download links and ZIP link", () => {
  const html = render([{ id: 4, title: "2° trimestre 2026", files: [file(7, "fattura.pdf"), file(9, "estratto.xml", { sizeBytes: 1048576 })] }]);
  assert.match(html, /<h2[^>]*>2° trimestre 2026<\/h2>/);
  assert.match(html, /<table/);
  assert.equal([...html.matchAll(/<th scope="col"/g)].length, 4);
  assert.match(html, /<th scope="row"[^>]*>fattura\.pdf<\/th>/);
  assert.match(html, /0,42 MB/);
  assert.match(html, /1,00 MB/);
  assert.match(html, /06\/11\/2026, 10:30/);
  assert.match(html, /href="\/api\/contabilita\/files\/7"/);
  assert.match(html, /href="\/api\/contabilita\/files\/9"/);
  assert.match(html, /href="\/api\/contabilita\/sections\/4\/zip"/);
  assert.match(html, /Scarica tutto \(ZIP\)/);
  // The link text names the file for screen readers.
  assert.match(html, /Scarica<span class="sr-only"> fattura\.pdf<\/span>/);
  assert.doesNotMatch(html, /Nessun documento disponibile|Nessun file in questa sezione/);
});

test("an empty section next to a full one says so and has no ZIP link", () => {
  const html = render([
    { id: 2, title: "Vuota", files: [] },
    { id: 1, title: "Piena", files: [file(3, "a.csv")] },
  ]);
  assert.match(html, /Nessun file in questa sezione/);
  assert.equal([...html.matchAll(/\/zip"/g)].length, 1);
  assert.match(html, /sections\/1\/zip/);
  assert.doesNotMatch(html, /sections\/2\/zip/);
  // Sections keep the order they are given.
  assert.ok(html.indexOf("Vuota") < html.indexOf("Piena"));
});

test("file and section names are text, never HTML", () => {
  const html = render([{ id: 1, title: "<img src=x onerror=alert(1)>", files: [file(5, "<script>alert(1)</script>.pdf")] }]);
  assert.doesNotMatch(html, /<script|<img/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;\.pdf/);
});

test("only DTO fields reach the markup: no download history, no server names", () => {
  const html = render([{ id: 1, title: "S", files: [file(5, "a.pdf", { lastDownloadAt: "2026-11-07T08:00:00.000Z" })] }]);
  assert.doesNotMatch(html, /07\/11\/2026/);
  assert.doesNotMatch(html, /\.enc|[0-9a-f]{8}-[0-9a-f]{4}-/);
});
