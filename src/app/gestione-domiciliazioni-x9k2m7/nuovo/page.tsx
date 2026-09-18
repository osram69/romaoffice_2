import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";
import { GestioneNav } from "@/components/GestioneNav";
import { DomForm } from "@/components/DomForm";
import { createDomiciliazioneAction } from "../actions";

export default async function NewDomiciliazionePage() {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect("/gestione-tariffe-x9k2m7/login?next=/gestione-domiciliazioni-x9k2m7");

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <GestioneNav role={user.role} active="domiciliazioni" username={user.username} />
      <h1 className="text-xl font-semibold">Nuova domiciliazione</h1>
      <DomForm action={createDomiciliazioneAction} />
    </div>
  );
}
