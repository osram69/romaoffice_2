import { escapeHtml } from "./standard-offer";
import { BASE_URL } from "./site";

// Email with a new temporary Area Clienti password, sent by staff from the company's edit form. Same look as the
// order confirmation (table layout, inline styles); the password is the only secret in it and it is never logged.
const INK = "#183229", ACCENT = "#F97300", CREAM = "#F5F1E9", LINE = "#E7E2D8", MUTED = "#5d6b66", FOOT = "#10261f";
const FONT = "Arial,'Helvetica Neue',Helvetica,sans-serif";

export const NEW_PASSWORD_SUBJECT = "Nuova password per la tua Area Clienti - Roma Office Sharing";

export function buildNewPasswordEmail(i: { greeting: string; email: string; password: string; areaUrl: string }): { html: string; text: string } {
  const e = escapeHtml;
  const greeting = i.greeting || "Buongiorno,";
  const intro = "come richiesto abbiamo generato una nuova password provvisoria per accedere alla tua Area Clienti. La password precedente non è più valida.";
  const sms = "Dopo la password ti verrà inviato un codice SMS al cellulare registrato. Al primo accesso ti verrà chiesto di scegliere una nuova password personale.";
  const warn = "Se non hai chiesto tu questa password, contattaci subito.";
  const signOff = "Roma Office Sharing — +39 06 21.11.6268 — info@romaofficesharing.it";

  const text = [greeting, intro, `Indirizzo: ${i.areaUrl}\nUtente (email): ${i.email}\nPassword provvisoria: ${i.password}`, sms, warn, signOff].join("\n\n");

  const td = (content: string, style = "") => `<td style="font-family:${FONT};${style}">${content}</td>`;
  const kv = (label: string, value: string, mono = false) =>
    `<tr>${td(e(label), `padding:7px 12px 7px 0;font-size:13px;color:${MUTED};vertical-align:top;width:38%`)}${td(mono ? `<span style="font-family:'Courier New',Courier,monospace;letter-spacing:.5px">${e(value)}</span>` : e(value), `padding:7px 0;font-size:14px;color:${INK};vertical-align:top;font-weight:bold;word-break:break-word`)}</tr>`;
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nuova password</title></head>
<body style="margin:0;padding:0;background:${CREAM}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
    <tr><td style="background:#ffffff;border-radius:10px 10px 0 0;border-bottom:3px solid ${ACCENT};padding:22px 28px">
      <img src="${e(BASE_URL)}/images/logo-pdf.png" width="170" alt="Roma Office Sharing" style="display:block;border:0;height:auto;max-width:170px;font-family:${FONT};font-size:16px;font-weight:bold;color:${INK}">
    </td></tr>
    <tr><td style="background:#ffffff;padding:26px 28px 8px;font-family:${FONT};color:${INK}">
      <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;line-height:1.2;color:${INK}">Nuova password</h1>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6">${e(greeting)}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6">${e(intro)}</p>
    </td></tr>
    <tr><td style="background:#ffffff;padding:0 28px 8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="background:#ffffff;border:1px solid ${LINE};border-left:4px solid ${ACCENT};border-radius:8px;padding:16px 20px;font-family:${FONT};font-size:14px;line-height:1.55;color:${INK}"><b>La tua Area Clienti</b>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 0;background:${CREAM};border-radius:6px"><tr><td style="padding:10px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${kv("Utente (email)", i.email)}${kv("Password provvisoria", i.password, true)}</table></td></tr></table>
        <div style="font-size:12px;color:${MUTED};margin-top:8px">${e(sms)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 0"><tr><td style="background:${ACCENT};border-radius:6px"><a href="${e(i.areaUrl)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none">Accedi all’Area Clienti</a></td></tr></table>
      </td></tr></table>
      <p style="margin:6px 0 22px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED}">${e(warn)}</p>
    </td></tr>
    <tr><td style="background:${FOOT};border-radius:0 0 10px 10px;padding:20px 28px;font-family:${FONT};font-size:12px;line-height:1.7;color:#d7e0dc">
      <b style="color:#ffffff">Roma Office Sharing</b> — Cube Engineering s.r.l.<br>Via San Martino della Battaglia, 31 – 00185 Roma<br>
      <a href="tel:+390621116268" style="color:#d7e0dc;text-decoration:none">+39 06 21.11.6268</a> · <a href="mailto:info@romaofficesharing.it" style="color:#d7e0dc;text-decoration:underline">info@romaofficesharing.it</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
  return { html, text };
}
