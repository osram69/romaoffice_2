import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { GestioneShell } from "@/components/GestioneNav";
import { DomForm } from "@/components/DomForm";
import { createDomiciliazioneAction } from "../actions";

export default async function NewDomiciliazionePage() {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect("/gestione-tariffe-x9k2m7/login?next=/gestione-domiciliazioni-x9k2m7");

  return (
    <GestioneShell role={user.role} active="domiciliazioni" username={user.username}>
      <h1 className="gestione-h1" style={{ marginBottom: 16 }}>Nuova domiciliazione</h1>
      <DomForm action={createDomiciliazioneAction} />
    </GestioneShell>
  );
}
