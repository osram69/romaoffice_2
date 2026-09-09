import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customerPasswordTokens, customers } from "@/db/schema";
import { digest, token } from "./customer-auth";
import { sendMail } from "./mailer";
import type { Lang } from "./site";

export async function inviteCustomer(customer: typeof customers.$inferSelect, lang: Lang) {
  const raw = token();
  await db.delete(customerPasswordTokens).where(eq(customerPasswordTokens.customerId, customer.id));
  await db.insert(customerPasswordTokens).values({ customerId: customer.id, tokenHash: digest(raw), expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.romaofficesharing.it";
  const url = `${origin}${lang === "it" ? "/area-clienti.html" : "/en/customer-area.html"}?setup=${raw}`;
  const text = lang === "it"
    ? `Roma Office Sharing — Area Clienti\n\nImposta o reimposta la tua password tramite il link seguente. Il link è personale, utilizzabile una sola volta e valido per un’ora.\n${url}\n\nDopo aver impostato la password, l’accesso richiederà anche un codice SMS inviato al cellulare registrato. Se non hai richiesto questa operazione, ignora l’email. Assistenza: +39 06 21116268.`
    : `Roma Office Sharing — Customer Area\n\nSet or reset your password using the link below. This personal, single-use link expires in one hour.\n${url}\n\nAfter setting a password, sign-in will also require an SMS code sent to your registered mobile. If you did not request this, ignore this email. Support: +39 06 21116268.`;
  const delivery = await sendMail({ to: customer.email, subject: lang === "it" ? "Area Clienti — imposta la tua password" : "Customer Area — set your password", text, html: `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>` });
  if (!delivery.sent) await db.delete(customerPasswordTokens).where(eq(customerPasswordTokens.tokenHash, digest(raw)));
  return delivery.sent;
}
