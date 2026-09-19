import nodemailer from "nodemailer";

export type MailAttachment = { filename: string; content: Buffer; contentType?: string };
export type MailPayload = { to: string; subject: string; text: string; html: string; attachments?: MailAttachment[]; bcc?: string; cc?: string };
export type MailResult = { sent: boolean; reason?: string; messageId?: string };

export function adminEmail(): string {
  return process.env.ADMIN_EMAIL || "info@romaofficesharing.it";
}

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Never throws: a failed email must not break the request flow, but must be reported. */
export async function sendMail(payload: MailPayload): Promise<MailResult> {
  if (!smtpConfigured()) return { sent: false, reason: "smtp-not-configured" };
  return deliver({
    host: process.env.SMTP_HOST as string, port: Number(process.env.SMTP_PORT || 465),
    user: process.env.SMTP_USER as string, pass: process.env.SMTP_PASS as string,
    from: process.env.MAIL_FROM || (process.env.SMTP_USER as string),
  }, payload);
}

// The two mailboxes the domiciliazioni tool sends from — kept distinct from the site's own
// SMTP_* account above, matching the legacy tool's ajax_send_mail.php / ajax_invia_scadenza.php.
export type DomMailAccount = "ordinaria" | "pec";

function accountEnv(account: DomMailAccount) {
  const prefix = account === "pec" ? "PEC_SMTP" : "ORDINARIA_SMTP";
  return {
    host: process.env[`${prefix}_HOST`], port: Number(process.env[`${prefix}_PORT`] || 465),
    user: process.env[`${prefix}_USER`], pass: process.env[`${prefix}_PASS`],
    from: process.env[`${prefix}_FROM`] || process.env[`${prefix}_USER`],
  };
}

export function domAccountConfigured(account: DomMailAccount): boolean {
  const env = accountEnv(account);
  return Boolean(env.host && env.user && env.pass);
}

export async function sendDomMail(account: DomMailAccount, payload: MailPayload): Promise<MailResult> {
  const env = accountEnv(account);
  if (!env.host || !env.user || !env.pass) return { sent: false, reason: `${account}-smtp-not-configured` };
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
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: payload.attachments,
    });
    const accepted = (info.accepted || []).map(value => String(value).toLowerCase());
    if (!accepted.includes(payload.to.toLowerCase())) return { sent: false, reason: "recipient-rejected" };
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error("Mail delivery failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return { sent: false, reason: "smtp-error" };
  }
}
