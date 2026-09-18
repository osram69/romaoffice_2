"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import { STAFF_SESSION_COOKIE, getStaffUser } from "@/lib/staff-auth";

const BASE_PATH = "/gestione-domiciliazioni-x9k2m7";

async function requireStaff() {
  const store = await cookies();
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect(`/gestione-tariffe-x9k2m7/login?next=${BASE_PATH}`);
  return user;
}

function str(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}
function dateOrNull(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}
function fields(formData: FormData) {
  return {
    ragioneSociale: String(formData.get("ragioneSociale") ?? "").trim(),
    emailPosta: String(formData.get("emailPosta") ?? "").trim(),
    emailPec: str(formData, "emailPec"),
    amministratore: str(formData, "amministratore"),
    telefonoAmm: str(formData, "telefonoAmm"),
    personaRif: str(formData, "personaRif"),
    telefono: str(formData, "telefono"),
    telefonoUrg: str(formData, "telefonoUrg"),
    inizioDom: dateOrNull(formData, "inizioDom"),
    scadenzaDom: dateOrNull(formData, "scadenzaDom"),
    scadenzaPagamento: dateOrNull(formData, "scadenzaPagamento"),
    contrFirmato: formData.get("contrFirmato") === "on",
    controfirmatoInviato: formData.get("controfirmatoInviato") === "on",
    moduloCont: formData.get("moduloCont") === "on",
    docAmmPres: formData.get("docAmmPres") === "on",
    allegato1Pres: formData.get("allegato1Pres") === "on",
    visuraPres: formData.get("visuraPres") === "on",
    stato: Number(formData.get("stato")),
    note: str(formData, "note"),
    indSpedPosta: str(formData, "indSpedPosta"),
    tipologia: Number(formData.get("tipologia")) || 0,
    raccoglitore: Number(formData.get("raccoglitore")) || 0,
    prezzoRinnovo: formData.get("prezzoRinnovo") ? Math.round(Number(formData.get("prezzoRinnovo"))) : null,
  };
}

export async function createDomiciliazioneAction(formData: FormData) {
  "use server";
  await requireStaff();
  const [row] = await db.insert(domClients).values(fields(formData)).returning({ id: domClients.id });
  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}/${row.id}/modifica`);
}

export async function updateDomiciliazioneAction(formData: FormData) {
  "use server";
  await requireStaff();
  const id = Number(formData.get("id"));
  await db.update(domClients).set(fields(formData)).where(eq(domClients.id, id));
  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${id}`);
  revalidatePath(`${BASE_PATH}/${id}/modifica`);
}

export async function deleteDomiciliazioneAction(formData: FormData) {
  "use server";
  await requireStaff();
  const id = Number(formData.get("id"));
  await db.delete(domClients).where(eq(domClients.id, id));
  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
