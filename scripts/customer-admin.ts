import "dotenv/config";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db, pool } from "@/db";
import { customers, customerContracts, customerSessions, customerChallenges, customerPasswordTokens, customerAudit, authLimits } from "@/db/schema";
import { hashPassword } from "@/lib/customer-auth";
import { storeCustomerContract } from "@/lib/customer-documents";
import { inviteCustomer } from "@/lib/customer-invitations";

const command = process.argv[2];
const args = new Map<string, string>();
for (let i = 3; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1] || "");
function required(key: string) { const value = args.get(key); if (!value) throw new Error(`Missing --${key}`); return value; }
async function run() {
  if (command === "cleanup") {
    const now = new Date(); const auditBefore = new Date(Date.now() - 90 * 86400000);
    await db.delete(customerSessions).where(lt(customerSessions.expiresAt, now));
    await db.delete(customerChallenges).where(lt(customerChallenges.expiresAt, now));
    await db.delete(customerPasswordTokens).where(lt(customerPasswordTokens.expiresAt, now));
    await db.delete(authLimits).where(lt(authLimits.expiresAt, now));
    await db.delete(customerAudit).where(lt(customerAudit.createdAt, auditBefore));
    console.log("Expired authentication records and audit entries older than 90 days removed."); return;
  }
  const email = required("email").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email address");
  if (command === "invite") {
    const name = required("name"); const phone = required("phone");
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Phone must use E.164 international format");
    const lang = args.get("lang") === "en" ? "en" : "it";
    await db.insert(customers).values({ email, name, phone, companyName: args.get("company") || null, locale: lang }).onConflictDoNothing({ target: customers.email });
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    if (!customer.active || customer.phone !== phone) throw new Error("Existing account is disabled or phone differs. Review the account before re-inviting.");
    if (process.env.CUSTOMER_INITIAL_PASSWORD) {
      const password = process.env.CUSTOMER_INITIAL_PASSWORD;
      if (password.length < 12 || password.length > 128) throw new Error("Initial password must contain 12–128 characters");
      await db.update(customers).set({ passwordHash: await hashPassword(password) }).where(eq(customers.id, customer.id));
      await db.delete(customerSessions).where(eq(customerSessions.customerId, customer.id));
      await db.delete(customerChallenges).where(eq(customerChallenges.customerId, customer.id));
      console.log("Account provisioned with the securely supplied initial password. SMS verification remains mandatory.");
    } else {
      const sent = await inviteCustomer(customer, lang);
      console.log(sent ? "Customer invited. The personal email link expires in one hour." : "Account created, but invitation was not sent. Configure SMTP and rerun the invite command.");
      if (!sent) process.exitCode = 1;
    }
    return;
  }
  const [customer] = await db.select().from(customers).where(eq(customers.email, email));
  if (!customer) throw new Error("Customer not found. Invite the customer first.");
  if (command === "contract") {
    const content = await readFile(required("file"));
    const title = required("title"); const titleEn = required("title-en");
    const reference = args.get("reference") || `ROS-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const storageKey = await storeCustomerContract(content);
    const [document] = await db.insert(customerContracts).values({ customerId: customer.id, title, titleEn, reference, storageKey, sizeBytes: content.length }).returning({ id: customerContracts.id });
    await db.insert(customerAudit).values({ customerId: customer.id, documentId: document.id, event: "contract.published" });
    console.log(`Contract ${reference} encrypted and published to this customer only.`); return;
  }
  if (command === "phone") {
    const phone = required("phone");
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Phone must use E.164 format");
    await db.update(customers).set({ phone }).where(eq(customers.id, customer.id));
    await db.delete(customerSessions).where(eq(customerSessions.customerId, customer.id));
    await db.delete(customerChallenges).where(eq(customerChallenges.customerId, customer.id));
    await db.insert(customerAudit).values({ customerId: customer.id, event: "phone.changed_by_staff" });
    console.log("Registered phone updated; sessions and login challenges revoked."); return;
  }
  if (command === "disable") {
    await db.update(customers).set({ active: false }).where(eq(customers.id, customer.id));
    await db.delete(customerSessions).where(eq(customerSessions.customerId, customer.id));
    await db.delete(customerChallenges).where(eq(customerChallenges.customerId, customer.id));
    await db.delete(customerPasswordTokens).where(eq(customerPasswordTokens.customerId, customer.id));
    console.log("Customer access disabled and credentials revoked."); return;
  }
  throw new Error("Commands: invite, contract, phone, disable, cleanup. See docs/customer-area.md.");
}
run().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
