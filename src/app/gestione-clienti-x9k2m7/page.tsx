import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customerContracts, customers } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { GestioneShell } from "@/components/GestioneNav";
import { inviteCustomerAction, resendInviteAction, toggleActiveAction, updatePhoneAction, uploadContractAction } from "./actions";

function fmtDate(value: Date | null) {
  return value ? value.toLocaleDateString("it-IT") : "—";
}

export default async function GestioneClientiPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect("/gestione-tariffe-x9k2m7/login?next=/gestione-clienti-x9k2m7");
  if (user.role !== "admin") redirect("/gestione-domiciliazioni-x9k2m7");

  const [rows, contractCounts] = await Promise.all([
    db.select().from(customers).orderBy(desc(customers.createdAt)),
    db.select({ customerId: customerContracts.customerId, n: sql<number>`count(*)::int` }).from(customerContracts).groupBy(customerContracts.customerId),
  ]);
  const countByCustomer = new Map(contractCounts.map(c => [c.customerId, c.n]));

  return (
    <GestioneShell role={user.role} active="clienti" username={user.username}>
      <h1 className="gestione-h1" style={{ marginBottom: 20 }}>Gestione Clienti (Area Riservata)</h1>

      {error && <div className="gestione-login-error" style={{ marginBottom: 16 }}>{error}</div>}
      {ok && <div style={{ background: "#d4edda", color: "#155724", border: "1px solid #c3e6cb", borderRadius: 4, padding: "8px 12px", fontSize: 13, marginBottom: 16 }}>{ok}</div>}

      <section className="gestione-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Invita nuovo cliente</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: -6 }}>
          Crea l&apos;account e invia un&apos;email con un link personale (valido un&apos;ora) con cui il cliente imposta la propria password. L&apos;accesso richiederà comunque un codice SMS al primo utilizzo.
        </p>
        <form action={inviteCustomerAction} style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "end" }}>
          <div className="gestione-field" style={{ width: 220 }}><label>Email *</label><input name="email" type="email" required /></div>
          <div className="gestione-field" style={{ width: 200 }}><label>Nome e cognome *</label><input name="name" required /></div>
          <div className="gestione-field" style={{ width: 180 }}><label>Telefono (E.164) *</label><input name="phone" placeholder="+393331234567" required /></div>
          <div className="gestione-field" style={{ width: 200 }}><label>Società</label><input name="company" /></div>
          <div className="gestione-field" style={{ width: 100 }}>
            <label>Lingua</label>
            <select name="lang" defaultValue="it"><option value="it">Italiano</option><option value="en">English</option></select>
          </div>
          <button type="submit" className="gestione-btn gestione-btn-blue">Invita</button>
        </form>
      </section>

      <section className="gestione-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#232f3e", marginTop: 0 }}>Clienti ({rows.length})</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="gestione-table">
            <thead>
              <tr><th>Cliente</th><th>Telefono</th><th>Stato</th><th>Ultimo accesso</th><th>Contratti</th><th>Carica contratto</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(customer => (
                <tr key={customer.id}>
                  <td>
                    <b>{customer.name}</b><br />
                    <span style={{ fontSize: 11, color: "#666" }}>{customer.email}</span>
                    {customer.companyName && <><br /><span style={{ fontSize: 11, color: "#999" }}>{customer.companyName}</span></>}
                  </td>
                  <td>
                    <form id={`phone-${customer.id}`} action={updatePhoneAction}>
                      <input type="hidden" name="id" value={customer.id} />
                      <input name="phone" defaultValue={customer.phone} style={{ width: 150, fontSize: 12 }} />
                    </form>
                    <button form={`phone-${customer.id}`} type="submit" className="gestione-btn gestione-btn-outline" style={{ fontSize: 11, padding: "3px 8px", marginTop: 4 }}>Aggiorna</button>
                  </td>
                  <td>{customer.active ? <span style={{ color: "#28a745", fontWeight: 700 }}>Attivo</span> : <span style={{ color: "#dc3545", fontWeight: 700 }}>Disattivato</span>}</td>
                  <td>{fmtDate(customer.lastLoginAt)}</td>
                  <td style={{ textAlign: "center" }}>{countByCustomer.get(customer.id) ?? 0}</td>
                  <td>
                    <form action={uploadContractAction} encType="multipart/form-data" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
                      <input type="hidden" name="id" value={customer.id} />
                      <input name="title" placeholder="Titolo (IT)" style={{ fontSize: 11 }} />
                      <input name="titleEn" placeholder="Titolo (EN, opzionale)" style={{ fontSize: 11 }} />
                      <input name="file" type="file" accept="application/pdf" style={{ fontSize: 11 }} />
                      <button type="submit" className="gestione-btn gestione-btn-outline" style={{ fontSize: 11, padding: "3px 8px" }}>Carica</button>
                    </form>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <form action={resendInviteAction} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={customer.id} />
                      <button type="submit" className="gestione-btn gestione-btn-outline" style={{ fontSize: 11, padding: "3px 8px", marginBottom: 4 }}>Reinvia invito/reset</button>
                    </form>
                    <br />
                    <form action={toggleActiveAction} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={customer.id} />
                      <input type="hidden" name="active" value={(!customer.active).toString()} />
                      <button type="submit" className={`gestione-btn ${customer.active ? "gestione-btn-red" : "gestione-btn-blue"}`} style={{ fontSize: 11, padding: "3px 8px" }}>
                        {customer.active ? "Disattiva" : "Riattiva"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#999", padding: 24 }}>Nessun cliente ancora invitato.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </GestioneShell>
  );
}
