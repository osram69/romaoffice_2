import nodemailer from "nodemailer";

export type MailAttachment = { filename: string; content: Buffer; contentType?: string };
export type MailPayload = { to: string; subject: string; text: string; html: string; attachments?: MailAttachment[]; bcc?: string; cc?: string; replyTo?: string };
export type MailResult = { sent: boolean; reason?: string; messageId?: string };

export function adminEmail(): string {
  return process.env.ADMIN_EMAIL || "info@romaofficesharing.it";
}

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Never throws: a failed email must not break the request flow, but must be reported. */
export async function sendMail(payload: MailPayload): Promise<MailResult> {
  if (!smtpConfigured()) { console.error("Mail not sent: SMTP_HOST/SMTP_USER/SMTP_PASS are not all set"); return { sent: false, reason: "smtp-not-configured" }; }
  const fromAddress = process.env.MAIL_FROM || (process.env.SMTP_USER as string);
  // A bare address in the From header shows up in most mail clients as just its local part
  // ("info" for info@romaofficesharing.it) instead of a real sender name — same fix already
  // applied to the dom-specific accounts below (accountEnv), just not here until now.
  const fromName = process.env.MAIL_FROM_NAME || "Roma Office Sharing";
  return deliver({
    host: process.env.SMTP_HOST as string, port: Number(process.env.SMTP_PORT || 465),
    user: process.env.SMTP_USER as string, pass: process.env.SMTP_PASS as string,
    from: `"${fromName}" <${fromAddress}>`,
  }, payload);
}

// The two mailboxes the domiciliazioni tool sends from — kept distinct from the site's own
// SMTP_* account above, matching the legacy tool's ajax_send_mail.php / ajax_invia_scadenza.php.
export type DomMailAccount = "ordinaria" | "pec";

function accountEnv(account: DomMailAccount) {
  const prefix = account === "pec" ? "PEC_SMTP" : "ORDINARIA_SMTP";
  const fromAddress = process.env[`${prefix}_FROM`] || process.env[`${prefix}_USER`];
  // A bare address in the From header shows up in most mail clients as just its local part
  // ("posta" for posta@romaofficesharing.it) instead of a real sender name — wrap it with a
  // display name (overridable per account via _FROM_NAME) so recipients see "Roma Office Sharing".
  const fromName = process.env[`${prefix}_FROM_NAME`] || "Roma Office Sharing";
  return {
    host: process.env[`${prefix}_HOST`], port: Number(process.env[`${prefix}_PORT`] || 465),
    user: process.env[`${prefix}_USER`], pass: process.env[`${prefix}_PASS`],
    from: fromAddress ? `"${fromName}" <${fromAddress}>` : fromAddress,
  };
}

export function domAccountConfigured(account: DomMailAccount): boolean {
  const env = accountEnv(account);
  return Boolean(env.host && env.user && env.pass);
}

export async function sendDomMail(account: DomMailAccount, payload: MailPayload): Promise<MailResult> {
  const env = accountEnv(account);
  if (!env.host || !env.user || !env.pass) { console.error(`Mail not sent: ${account} SMTP account is not fully configured`); return { sent: false, reason: `${account}-smtp-not-configured` }; }
  return deliver({ host: env.host, port: env.port, user: env.user, pass: env.pass, from: env.from as string }, payload);
}

async function deliver(account: { host: string; port: number; user: string; pass: string; from: string }, payload: MailPayload): Promise<MailResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: account.host,
      port: account.port,
      secure: account.port === 465,
      auth: { user: account.user, pass: account.pass },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    });
    const info = await transporter.sendMail({
      from: account.from,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      replyTo: payload.replyTo,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: payload.attachments,
    });
    // payload.to can be a comma-separated list (e.g. the PEC channel "to"s both the ordinary
    // address and the PEC address) — info.accepted lists each address individually, so every
    // requested address must appear in it, not the joined string as a single entry.
    const requestedTo = payload.to.split(",").map(addr => addr.trim().toLowerCase()).filter(Boolean);
    const accepted = (info.accepted || []).map(value => String(value).toLowerCase());
    const allAccepted = requestedTo.length > 0 && requestedTo.every(addr => accepted.includes(addr));
    if (!allAccepted) {
      console.error("Mail delivery failed: recipient rejected", { to: payload.to, accepted: info.accepted, rejected: info.rejected });
      return { sent: false, reason: "recipient-rejected" };
    }
    console.log("Mail delivered", { to: payload.to, host: account.host, user: account.user, messageId: info.messageId });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    // Logs the real SMTP failure reason (e.g. auth rejected, host unreachable) — never the
    // password itself, since nodemailer/SMTP error messages don't echo credentials back.
    console.error("Mail delivery failed", { host: account.host, user: account.user, name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error) });
    return { sent: false, reason: "smtp-error" };
  }
}
