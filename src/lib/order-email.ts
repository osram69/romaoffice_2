import { escapeHtml } from "./standard-offer";
import { BASE_URL } from "./site";

// The confirmation email sent after an online purchase / request (customer copy and admin copy). Table-based
// layout with inline styles: the only thing every mail client renders the same way. The same data also builds
// the plain-text part, so clients that don't show HTML still get a tidy message.
const INK = "#183229", ACCENT = "#F97300", CREAM = "#F5F1E9", LINE = "#E7E2D8", MUTED = "#5d6b66", FOOT = "#10261f";
const FONT = "Arial,'Helvetica Neue',Helvetica,sans-serif";

export type ConfirmationEmailInput = {
  lang: "it" | "en";
  postal: boolean;
  serviceName: string;
  shortRef: string;
  durationText: string;
  startDate: string; // ISO yyyy-mm-dd, as typed in the request form
  representativeName: string;
  representativeTaxCode: string;
  email: string;
  phone: string;
  companyPec?: string;
  companySdi?: string;
  addonLines: { label: string; amount: string }[];
  net: string; vat: string; vatPercent: string; total: string;
  paymentMethod: string;
  paymentLabel: string;
  bank?: { holder: string; iban: string; bic: string; bank: string; causale: string; amount: string };
  /** The customer copy carries the Area Clienti access; the admin copy never does. */
  account: null | { alreadyHadAccess: boolean; email: string; password: string | null; phone: string };
  areaUrl: string;
  /** "Domiciliazione aggiuntiva": the capofila the buyer declared (shown in both copies). */
  parentCompany?: string;
  /** Only for the admin copy: a highlighted box (e.g. a capofila that still has to be checked). */
  adminNotice?: { tone: "ok" | "warn"; title: string; lines: string[] };
};

export function formatStartDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`; // day first in both languages
}

type Status = { text: string; fg: string; bg: string };
function paymentStatus(method: string, it: boolean): Status {
  if (method === "bank_transfer") return { text: it ? "In attesa del bonifico" : "Awaiting bank transfer", fg: "#8a5a00", bg: "#fff1d6" };
  if (method === "on_site") return { text: it ? "Pagamento in sede" : "Payment on site", fg: "#8a5a00", bg: "#fff1d6" };
  return { text: it ? "Pagamento confermato" : "Payment confirmed", fg: "#176b43", bg: "#e2f4ea" };
}

export function buildConfirmationEmail(i: ConfirmationEmailInput): { html: string; text: string; preheader: string } {
  const it = i.lang === "it";
  const e = escapeHtml;
  const start = formatStartDate(i.startDate);
  const status = paymentStatus(i.paymentMethod, it);
  const online = i.paymentMethod !== "bank_transfer" && i.paymentMethod !== "on_site";

  const title = it ? "Richiesta ricevuta" : "Request received";
  const greeting = it ? `Gentile ${i.representativeName},` : `Dear ${i.representativeName},`;
  const intro = it
    ? `abbiamo registrato la Sua richiesta di ${i.serviceName}. In allegato trova il modulo di richiesta compilato in PDF${i.postal ? ", con l’Allegato 1 e le condizioni accettate" : ""}.`
    : `we have recorded your application for ${i.serviceName}. Attached is your completed application form as a PDF${i.postal ? ", with Annex 1 and the accepted terms" : ""}.`;
  const closing = it ? "L’attivazione è subordinata alla verifica della documentazione e al contratto." : "Activation is subject to document review and agreement.";
  const preheader = it ? `${i.serviceName} — pratica ${i.shortRef}: richiesta registrata.` : `${i.serviceName} — reference ${i.shortRef}: request recorded.`;

  const L = {
    summary: it ? "Riepilogo della richiesta" : "Request summary",
    service: it ? "Servizio" : "Service", ref: it ? "Pratica" : "Reference", duration: it ? "Durata" : "Duration", start: it ? "Decorrenza" : "Start date",
    holder: it ? "Referente" : "Contact", taxCode: it ? "Codice fiscale" : "Tax code", email: "Email", phone: it ? "Cellulare" : "Mobile",
    pec: "PEC", sdi: "SDI",
    cost: it ? "Importi" : "Amounts", net: it ? "Imponibile" : "Net amount", vat: it ? "IVA" : "VAT", total: it ? "Totale" : "Total",
    payment: it ? "Pagamento" : "Payment", method: it ? "Modalità" : "Method",
    bankTitle: it ? "Coordinate per il bonifico" : "Bank transfer details",
    holderB: it ? "Intestatario" : "Account holder", bankName: it ? "Banca" : "Bank", reason: it ? "Causale" : "Reason", amount: it ? "Importo" : "Amount",
    onlineOk: it ? "Il pagamento online è stato confermato. Grazie!" : "Your online payment has been confirmed. Thank you!",
    onSite: it ? "Pagamento anticipato in sede. Concorda un appuntamento con la reception prima della decorrenza. Nessun deposito cauzionale." : "Payment in advance on site. Arrange a reception appointment before the start date. No security deposit.",
    area: it ? "La tua Area Clienti" : "Your Customer Area",
    areaActive: it ? "La tua Area Clienti è già attiva: puoi compilare online il contratto completo (con i controlli sui campi obbligatori), scaricarlo, firmarlo e ricaricarlo." : "Your Customer Area is already active: you can fill in the full contract online (with checks on required fields), download it, sign it and upload it again.",
    areaExisting: it ? "Accedi con le credenziali che già utilizzi per compilare online il contratto." : "Sign in with your existing credentials to fill in your contract online.",
    user: it ? "Utente (email)" : "User (email)", pass: it ? "Password provvisoria" : "Temporary password",
    sms: it ? `Dopo la password ti verrà inviato un codice SMS al cellulare ${i.account?.phone ?? ""}. Ti consigliamo di cambiare la password al primo accesso.` : `After the password, an SMS code is sent to ${i.account?.phone ?? ""}. We recommend changing the password the first time you sign in.`,
    button: it ? "Accedi all’Area Clienti" : "Open the Customer Area",
    address: it ? "Via San Martino della Battaglia, 31 – 00185 Roma" : "Via San Martino della Battaglia, 31 – 00185 Rome",
  };

  // --- plain text -------------------------------------------------------------------------------
  const textRows = [
    i.serviceName,
    `${L.ref}: ${i.shortRef}`,
    `${L.duration}: ${i.durationText} — ${L.start.toLowerCase()}: ${start}`,
    `${L.holder}: ${i.representativeName} (${L.taxCode} ${i.representativeTaxCode})`,
    `${L.email}: ${i.email} — ${L.phone}: ${i.phone}`,
    ...(i.companyPec ? [`PEC: ${i.companyPec}`] : []),
    ...(i.companySdi ? [`SDI: ${i.companySdi}`] : []),
    ...(i.parentCompany ? [`${it ? "Società capofila" : "Main company"}: ${i.parentCompany}`] : []),
  ];
  const textCost = [
    ...i.addonLines.map(a => `${a.label}: ${a.amount}`),
    `${L.net}: ${i.net}`, `${L.vat} ${i.vatPercent}: ${i.vat}`, `${L.total}: ${i.total}`, `${L.method}: ${i.paymentLabel}`,
  ];
  const textPayment = i.paymentMethod === "bank_transfer" && i.bank
    ? [`${L.bankTitle}:`, `${L.holderB}: ${i.bank.holder}`, `IBAN: ${i.bank.iban}`, `BIC/SWIFT: ${i.bank.bic}`, `${L.bankName}: ${i.bank.bank}`, `${L.reason}: ${i.bank.causale}`, `${L.amount}: ${i.bank.amount}`]
    : [online ? L.onlineOk : L.onSite];
  const textAccount = !i.account ? [] : i.account.alreadyHadAccess
    ? [`${L.area}: ${L.areaExisting}`, i.areaUrl]
    : [`${L.area}: ${L.areaActive}`, `${it ? "Indirizzo" : "Address"}: ${i.areaUrl}`, `${L.user}: ${i.account.email}`, `${L.pass}: ${i.account.password ?? ""}`, L.sms];
  const signOff = "Roma Office Sharing — +39 06 21.11.6268 — info@romaofficesharing.it";
  const textNotice = i.adminNotice ? [[i.adminNotice.title, ...i.adminNotice.lines].join("\n")] : [];
  const text = [...(textNotice.length ? [textNotice[0]] : []), greeting, intro, textRows.join("\n"), textCost.join("\n"), textPayment.join("\n"), ...(textAccount.length ? [textAccount.join("\n")] : []), closing, signOff].join("\n\n");

  // --- html -------------------------------------------------------------------------------------
  const td = (content: string, style = "") => `<td style="font-family:${FONT};${style}">${content}</td>`;
  const kv = (label: string, value: string, opts: { bold?: boolean; mono?: boolean } = {}) =>
    `<tr>${td(e(label), `padding:7px 12px 7px 0;font-size:13px;color:${MUTED};vertical-align:top;width:38%`)}${td(`${opts.mono ? `<span style="font-family:'Courier New',Courier,monospace;letter-spacing:.5px">${e(value)}</span>` : e(value)}`, `padding:7px 0;font-size:14px;color:${INK};vertical-align:top;${opts.bold ? "font-weight:bold;" : ""}word-break:break-word`)}</tr>`;
  const rule = `<tr><td colspan="2" style="border-top:1px solid ${LINE};font-size:0;line-height:0;height:1px">&nbsp;</td></tr>`;
  const card = (heading: string, rows: string, tone = "#ffffff") =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="background:${tone};border:1px solid ${LINE};border-radius:8px;padding:16px 20px">
      <div style="font-family:${FONT};font-size:11px;letter-spacing:1.6px;font-weight:bold;color:${ACCENT};text-transform:uppercase;margin:0 0 6px">${e(heading)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr></table>`;

  const summaryRows = [
    kv(L.service, i.serviceName, { bold: true }), kv(L.ref, i.shortRef, { mono: true }), kv(L.duration, i.durationText), kv(L.start, start),
    rule, kv(L.holder, i.representativeName), kv(L.taxCode, i.representativeTaxCode, { mono: true }), kv(L.email, i.email), kv(L.phone, i.phone),
    ...(i.companyPec ? [kv("PEC", i.companyPec)] : []), ...(i.companySdi ? [kv("SDI", i.companySdi, { mono: true })] : []),
    ...(i.parentCompany ? [rule, kv(it ? "Società capofila" : "Main company", i.parentCompany)] : []),
  ].join("");

  const costRows = [
    ...i.addonLines.map(a => kv(a.label, a.amount)),
    kv(L.net, i.net), kv(`${L.vat} ${i.vatPercent}`, i.vat), rule,
    `<tr>${td(e(L.total), `padding:10px 12px 4px 0;font-size:15px;font-weight:bold;color:${INK}`)}${td(e(i.total), `padding:10px 0 4px;font-size:22px;font-weight:bold;color:${INK}`)}</tr>`,
    `<tr>${td(e(L.method), `padding:4px 12px 4px 0;font-size:13px;color:${MUTED}`)}${td(`${e(i.paymentLabel)} &nbsp;<span style="display:inline-block;background:${status.bg};color:${status.fg};font-size:12px;font-weight:bold;padding:3px 10px;border-radius:12px">${e(status.text)}</span>`, `padding:4px 0;font-size:14px;color:${INK}`)}</tr>`,
  ].join("");

  const paymentCard = i.paymentMethod === "bank_transfer" && i.bank
    ? card(L.bankTitle, [kv(L.holderB, i.bank.holder, { bold: true }), kv("IBAN", i.bank.iban, { bold: true, mono: true }), kv("BIC/SWIFT", i.bank.bic, { mono: true }), kv(L.bankName, i.bank.bank), kv(L.reason, i.bank.causale, { bold: true }), kv(L.amount, i.bank.amount, { bold: true })].join(""), "#fffaf0")
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="background:${status.bg};border-radius:8px;padding:14px 20px;font-family:${FONT};font-size:14px;line-height:1.5;color:${status.fg}"><b>${e(online ? "✓ " : "")}${e(online ? L.onlineOk : L.onSite)}</b></td></tr></table>`;

  const button = (href: string, label: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 0"><tr><td style="background:${ACCENT};border-radius:6px"><a href="${e(href)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none">${e(label)}</a></td></tr></table>`;
  const accountCard = !i.account ? "" : i.account.alreadyHadAccess
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="background:#ffffff;border:1px solid ${LINE};border-left:4px solid ${ACCENT};border-radius:8px;padding:16px 20px;font-family:${FONT};font-size:14px;line-height:1.55;color:${INK}"><b>${e(L.area)}</b><br>${e(L.areaExisting)}${button(i.areaUrl, L.button)}</td></tr></table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="background:#ffffff;border:1px solid ${LINE};border-left:4px solid ${ACCENT};border-radius:8px;padding:16px 20px;font-family:${FONT};font-size:14px;line-height:1.55;color:${INK}"><b>${e(L.area)}</b><br>${e(L.areaActive)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 0;background:${CREAM};border-radius:6px"><tr><td style="padding:10px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${kv(L.user, i.account.email, { bold: true })}${kv(L.pass, i.account.password ?? "", { bold: true, mono: true })}</table></td></tr></table>
      <div style="font-size:12px;color:${MUTED};margin-top:8px">${e(L.sms)}</div>${button(i.areaUrl, L.button)}</td></tr></table>`;

  const noticeHtml = !i.adminNotice ? "" : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="background:${i.adminNotice.tone === "warn" ? "#fff1d6" : "#e2f4ea"};border:1px solid ${i.adminNotice.tone === "warn" ? "#e0a93b" : "#8fcaa5"};border-radius:8px;padding:14px 20px;font-family:${FONT};font-size:14px;line-height:1.55;color:${i.adminNotice.tone === "warn" ? "#6b4400" : "#176b43"}"><b>${e(i.adminNotice.title)}</b>${i.adminNotice.lines.map(line => `<br>${e(line)}`).join("")}</td></tr></table>`;

  const html = `<!doctype html><html lang="${i.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${e(title)}</title></head>
<body style="margin:0;padding:0;background:${CREAM}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREAM}">${e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
    <tr><td style="background:#ffffff;border-radius:10px 10px 0 0;border-bottom:3px solid ${ACCENT};padding:22px 28px">
      <img src="${e(BASE_URL)}/images/logo-pdf.png" width="170" alt="Roma Office Sharing" style="display:block;border:0;height:auto;max-width:170px;font-family:${FONT};font-size:16px;font-weight:bold;color:${INK}">
    </td></tr>
    <tr><td style="background:#ffffff;padding:26px 28px 8px;font-family:${FONT};color:${INK}">
      <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;line-height:1.2;color:${INK}">${e(title)}</h1>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6">${e(greeting)}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6">${e(intro)}</p>
    </td></tr>
    <tr><td style="background:#ffffff;padding:0 28px 8px">
      ${noticeHtml}
      ${card(L.summary, summaryRows)}
      ${card(L.cost, costRows)}
      ${paymentCard}
      ${accountCard}
      <p style="margin:6px 0 22px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED}">${e(closing)}</p>
    </td></tr>
    <tr><td style="background:${FOOT};border-radius:0 0 10px 10px;padding:20px 28px;font-family:${FONT};font-size:12px;line-height:1.7;color:#d7e0dc">
      <b style="color:#ffffff">Roma Office Sharing</b> — Cube Engineering s.r.l.<br>${e(L.address)}<br>
      <a href="tel:+390621116268" style="color:#d7e0dc;text-decoration:none">+39 06 21.11.6268</a> · <a href="mailto:info@romaofficesharing.it" style="color:#d7e0dc;text-decoration:underline">info@romaofficesharing.it</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;

  return { html, text, preheader };
}
