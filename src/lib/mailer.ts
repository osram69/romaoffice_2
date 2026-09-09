import nodemailer from "nodemailer";

export type MailAttachment = { filename: string; content: Buffer; contentType?: string };
export type MailPayload = { to: string; subject: string; text: string; html: string; attachments?: MailAttachment[]; bcc?: string };
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
  try {
    const port = Number(process.env.SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER as string, pass: process.env.SMTP_PASS as string },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    });
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || (process.env.SMTP_USER as string),
      to: payload.to,
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
