/** Files the customer uploaded from the Area Clienti, as seen by staff: "cli" = the printed and signed contract,
 * "clidoc" = the administrator's document. Fetched through the staff-only /api/dom-documents route (decrypted on the
 * server) and handed to the contract processor as an ordinary File, exactly as if it had been picked from disk. */
export type ClientUpload = "cli" | "clidoc";

export async function fetchClientUpload(domClientId: number, kind: ClientUpload): Promise<File> {
  const res = await fetch(`/api/dom-documents?id=${domClientId}&type=${kind}`, { cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "sessione scaduta: ricarica la pagina e accedi di nuovo" : "file non trovato nell'archivio");
  const blob = await res.blob();
  const name = kind === "cli" ? "contratto-firmato-dal-cliente.pdf" : "documento-amministratore-dal-cliente.pdf";
  return new File([blob], name, { type: "application/pdf" });
}
