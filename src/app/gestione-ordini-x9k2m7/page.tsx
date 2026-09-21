import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, ilike } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { GestioneShell } from "@/components/GestioneNav";
import { formatEur } from "@/lib/pricing";
import { shortOrderRef } from "@/lib/order-ref";
import { resendConfirmationAction } from "./actions";
import type { RequestData } from "@/lib/request";

const STATUS_LABELS: Record<string, string> = { pending: "In corso", filled: "Inviata", paid: "Pagato", signed: "Firmato", cancelled: "Annullato" };
const RESENDABLE = new Set(["filled", "paid", "signed"]);

export default async function OrdiniPage({ searchParams }: { searchParams: Promise<{ q?: string; resent?: string }> }) {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect("/gestione-tariffe-x9k2m7/login?next=/gestione-ordini-x9k2m7");

  const { q } = await searchParams;
  const rows = await db.select().from(orders)
    .where(q ? ilike(orders.email, `%${q.trim()}%`) : undefined)
    .orderBy(desc(orders.createdAt)).limit(50);

  return (
    <GestioneShell role={user.role} active="ordini" username={user.username}>
      <h1 className="gestione-h1" style={{ marginBottom: 8 }}>Ordini Online</h1>
      <p style={{ fontSize: 12, color: "#666", marginTop: -4, marginBottom: 20 }}>
        Ultimi 50 ordini di attivazione online (sede legale / domiciliazione postale). &quot;Reinvia conferma&quot; è idempotente:
        se l&apos;email al cliente o all&apos;amministrazione è già stata inviata non viene rispedita — invia solo quella
        mancante, il caso tipico di un pagamento confermato dal provider prima che il cliente tornasse sul sito.
      </p>

      <form style={{ marginBottom: 16 }}>
        <input type="search" name="q" defaultValue={q ?? ""} placeholder="Cerca per email cliente…" className="gestione-field" style={{ maxWidth: 340, display: "inline-block" }} />
        <button type="submit" className="gestione-btn gestione-btn-outline" style={{ marginLeft: 8 }}>Cerca</button>
      </form>

      <div style={{ overflowX: "auto" }}>
        <table className="gestione-table">
          <thead>
            <tr>
              <th>Pratica</th><th>Cliente</th><th>Email</th><th>Servizio</th><th>Importo</th><th>Pagamento</th><th>Stato</th>
              <th>Email cliente</th><th>Email admin</th><th>Creato il</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(order => {
              const data = order.formData as RequestData | null;
              const ref = data?.representativeTaxCode ? shortOrderRef(data.representativeTaxCode, order.createdAt) : order.publicId.slice(0, 8);
              return (
                <tr key={order.publicId}>
                  <td>{ref}</td>
                  <td>{data?.representativeName || "—"}</td>
                  <td>{order.email}</td>
                  <td>{order.service === "postal" ? "Postale" : "Sede legale"}</td>
                  <td>{formatEur(order.amountCents, "it")}</td>
                  <td>{order.paymentMethod || "—"}</td>
                  <td>{STATUS_LABELS[order.status] || order.status}</td>
                  <td>{order.requestEmailSentAt ? new Date(order.requestEmailSentAt).toLocaleString("it-IT") : "non inviata"}</td>
                  <td>{order.adminEmailSentAt ? new Date(order.adminEmailSentAt).toLocaleString("it-IT") : "non inviata"}</td>
                  <td>{new Date(order.createdAt).toLocaleString("it-IT")}</td>
                  <td>
                    {RESENDABLE.has(order.status) && (
                      <form action={resendConfirmationAction}>
                        <input type="hidden" name="orderId" value={order.publicId} />
                        <button type="submit" className="gestione-btn gestione-btn-blue">Reinvia conferma</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={11} style={{ textAlign: "center", color: "#666" }}>Nessun ordine trovato.</td></tr>}
          </tbody>
        </table>
      </div>
    </GestioneShell>
  );
}
