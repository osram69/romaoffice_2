import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { GestioneNav } from "@/components/GestioneNav";
import { DomForm } from "@/components/DomForm";
import { updateDomiciliazioneAction, deleteDomiciliazioneAction } from "../actions";

export default async function EditDomiciliazionePage({ params }: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect("/gestione-tariffe-x9k2m7/login?next=/gestione-domiciliazioni-x9k2m7");

  const { id } = await params;
  const [client] = await db.select().from(domClients).where(eq(domClients.id, Number(id))).limit(1);
  if (!client) notFound();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <GestioneNav role={user.role} active="domiciliazioni" username={user.username} />
      <h1 className="text-xl font-semibold">{client.ragioneSociale}</h1>
      <DomForm client={client} action={updateDomiciliazioneAction} deleteAction={deleteDomiciliazioneAction} />
    </div>
  );
}
