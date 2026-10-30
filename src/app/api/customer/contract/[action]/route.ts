import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { domClients } from "@/db/schema";
import { CustomerError, failed, getDomCustomer, json, limit, protectMutation } from "@/lib/customer-auth";
import { loadContractDraft, markContractCompleted, saveContractDraft } from "@/lib/contract-draft";
import { PDFDocument } from "pdf-lib";
import { saveClientDocEncrypted, saveClientSignedEncrypted } from "@/lib/dom-archive";
import { adminEmail, sendMail } from "@/lib/mailer";
import { escapeHtml } from "@/lib/standard-offer";

type Props = { params: Promise<{ action: string }> };
export const dynamic = "force-dynamic";
const MAX_SIGNED_BYTES = 20 * 1024 * 1024;
const MAX_ADMIN_DOC_BYTES = 10 * 1024 * 1024;
const NO_STORE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(req: NextRequest, { params }: Props) {
  try {
    const { action } = await params;
    const client = await getDomCustomer(req);
    if (action === "draft") {
      const draft = await loadContractDraft(client);
      return json(draft);
    }
    if (action === "template") {
      await limit(`contract-template:${client.id}`, 60, 300);
      // The blank contract (standard or "aggiuntiva" variant, per the domiciliazione record); read from the repo, served only to a signed-in customer.
      const pdf = await readFile(path.join(process.cwd(), "src", "assets", "contract", client.aggiuntiva ? "contratto-domiciliazione-aggiuntiva.pdf" : "contratto-domiciliazione.pdf"));
      return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Length": String(pdf.length), ...NO_STORE } });
    }
    throw new CustomerError("notFound", 404);
  } catch (error) { return failed(error); }
}

export async function POST(req: NextRequest, { params }: Props) {
  try {
    protectMutation(req);
    const { action } = await params;
    const client = await getDomCustomer(req);
    if (action === "save") {
      await limit(`contract-save:${client.id}`, 300, 3600);
      const body = await req.json();
      try { await saveContractDraft(client, body.data); } catch { throw new CustomerError("invalid", 400); }
      return json({ ok: true, savedAt: new Date().toISOString() });
    }
    if (action === "completed") {
      await markContractCompleted(client);
      return json({ ok: true });
    }
    if (action === "signed") {
      await limit(`contract-signed:${client.id}`, 10, 3600);
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new CustomerError("invalid", 400);
      if (file.size === 0 || file.size > MAX_SIGNED_BYTES) throw new CustomerError("invalid", 400);
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new CustomerError("invalid", 400);
      await saveClientSignedEncrypted(client.legacyId ?? client.id, bytes);
      await db.update(domClients).set({ contrattoClienteAt: new Date() }).where(eq(domClients.id, client.id));
      const name = client.ragioneSociale;
      const text = `Il cliente ${name} ha caricato dall'Area Clienti il contratto stampato e firmato.\n\nIl file è anche disponibile nella scheda della società (Allegati PDF → “Contratto firmato dal cliente”). Per completare: apri "Carica e processa", aggiungi la firma del domiciliatario e carica il documento come Contratto.`;
      const html = `<p>Il cliente <b>${escapeHtml(name)}</b> ha caricato dall'Area Clienti il contratto stampato e firmato.</p><p>Il file è anche disponibile nella scheda della società (Allegati PDF → “Contratto firmato dal cliente”). Per completare: apri “Carica e processa”, aggiungi la firma del domiciliatario e carica il documento come Contratto.</p>`;
      await sendMail({ to: adminEmail(), subject: `Contratto firmato caricato dal cliente: ${name}`, text, html, attachments: [{ filename: `contratto-firmato-${(client.legacyId ?? client.id)}.pdf`, content: bytes, contentType: "application/pdf" }] });
      return json({ ok: true });
    }
    if (action === "admin-doc") {
      await limit(`contract-admin-doc:${client.id}`, 10, 3600);
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new CustomerError("invalid", 400);
      if (file.size === 0 || file.size > MAX_ADMIN_DOC_BYTES) throw new CustomerError("invalid", 400);
      let bytes = Buffer.from(await file.arrayBuffer());
      const isPdf = bytes.subarray(0, 5).toString("latin1") === "%PDF-";
      const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
      const isPng = bytes.subarray(1, 4).toString("latin1") === "PNG";
      if (!isPdf && !isJpg && !isPng) throw new CustomerError("invalid", 400);
      if (!isPdf) {
        // A photo/scan of the document: wrap it in a single A4 page so staff always get a PDF.
        const doc = await PDFDocument.create();
        const img = isJpg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
        const page = doc.addPage([595, 842]);
        const scale = Math.min(515 / img.width, 760 / img.height, 1);
        page.drawImage(img, { x: (595 - img.width * scale) / 2, y: 842 - 40 - img.height * scale, width: img.width * scale, height: img.height * scale });
        bytes = Buffer.from(await doc.save());
      }
      await saveClientDocEncrypted(client.legacyId ?? client.id, bytes);
      await db.update(domClients).set({ docAmmClienteAt: new Date() }).where(eq(domClients.id, client.id));
      const name = client.ragioneSociale;
      await sendMail({
        to: adminEmail(), subject: `Documento amministratore caricato dal cliente: ${name}`,
        text: `Il cliente ${name} ha caricato dall'Area Clienti il documento dell'amministratore. È nella scheda della società (Allegati PDF → “Documento amministratore dal cliente”): aggiungilo al contratto con “Carica e processa” → “Aggiungi PDF in coda”.`,
        html: `<p>Il cliente <b>${escapeHtml(name)}</b> ha caricato dall'Area Clienti il documento dell'amministratore. È nella scheda della società (Allegati PDF → “Documento amministratore dal cliente”): aggiungilo al contratto con “Carica e processa” → “Aggiungi PDF in coda”.</p>`,
        attachments: [{ filename: `documento-amministratore-${client.legacyId ?? client.id}.pdf`, content: bytes, contentType: "application/pdf" }],
      });
      return json({ ok: true });
    }
    throw new CustomerError("notFound", 404);
  } catch (error) { return failed(error); }
}
