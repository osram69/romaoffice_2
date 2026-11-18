import test from "node:test";
import assert from "node:assert/strict";
import { buildRitiroEmailHtml, DEFAULT_RITIRO_EMAIL_HTML } from "@/lib/dom-ritiro-email";

test("pickup email: personal greeting and singular wording when the administrator or reference person is known", () => {
  const woman = buildRitiroEmailHtml({ amministratore: "Maria Rossi", personaRif: null });
  assert.match(woman, /<p>Buongiorno Sig\.ra Rossi,<\/p>/);
  assert.ok(woman.includes("comunicarLe") && woman.includes("La invitiamo") && !woman.includes("comunicarVi"));
  assert.match(buildRitiroEmailHtml({ amministratore: "Mario Rossi", personaRif: null }), /Buongiorno Sig\. Rossi,/);
  // the reference person is used when there is no administrator
  assert.match(buildRitiroEmailHtml({ amministratore: null, personaRif: "Giulia Bianchi" }), /Buongiorno Sig\.ra Bianchi,/);
  // unknown or ambiguous first name: Sig.
  assert.match(buildRitiroEmailHtml({ amministratore: "Rossi", personaRif: null }), /Buongiorno Sig\. Rossi,/);
});

test("pickup email: without a person the generic text is kept", () => {
  assert.equal(buildRitiroEmailHtml({ amministratore: null, personaRif: null }), DEFAULT_RITIRO_EMAIL_HTML);
  assert.equal(buildRitiroEmailHtml({ amministratore: " ", personaRif: "" }, "<p>Testo mio</p>"), "<p>Testo mio</p>");
});

test("pickup email: a custom template keeps its text, only its opening greeting becomes personal", () => {
  const client = { amministratore: "Anna Verdi", personaRif: null };
  assert.equal(buildRitiroEmailHtml(client, "<p>Buongiorno,</p><p>Testo mio</p>"), "<p>Buongiorno Sig.ra Verdi,</p><p>Testo mio</p>");
  assert.equal(buildRitiroEmailHtml(client, "<p>Gentile cliente</p><p>Testo mio</p>"), "<p>Gentile cliente</p><p>Testo mio</p>");
  // a saved copy of the default text is still the default
  assert.match(buildRitiroEmailHtml(client, DEFAULT_RITIRO_EMAIL_HTML), /comunicarLe/);
});

test("pickup email: the default text saved through the rich-text editor (reformatted HTML) is still treated as the default", () => {
  const reformatted = "<p>Buongiorno,</p>\r\n<p>la presente per comunicarVi che è in giacenza presso i nostri uffici una notevole quantità di posta.</p>\n"
    + "<p>Vi invitiamo a provvedere al ritiro quanto prima o a richiedere la spedizione da parte nostra comunicandoci l'indirizzo di spedizione.</p>\n<p>Grazie<br />\nSegreteria Roma Office Sharing</p>";
  const html = buildRitiroEmailHtml({ amministratore: "Maria Rossi", personaRif: null }, reformatted);
  assert.ok(html.includes("Buongiorno Sig.ra Rossi,") && html.includes("comunicarLe") && html.includes("La invitiamo") && !html.includes("comunicarVi"));
  // an edited custom text gets only the person-specific forms
  const edited = buildRitiroEmailHtml({ amministratore: "Maria Rossi", personaRif: null }, "<p>Buongiorno,</p><p>Vi invitiamo al ritiro.</p>");
  assert.equal(edited, "<p>Buongiorno Sig.ra Rossi,</p><p>La invitiamo al ritiro.</p>");
});
