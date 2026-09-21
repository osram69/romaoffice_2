import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { adminEmail, sendMail } from "@/lib/mailer";
import { escapeHtml } from "@/lib/standard-offer";
import { verifyRecaptcha } from "@/lib/recaptcha";
const schema=z.object({lang:z.enum(["it","en"]).default("it"),name:z.string().trim().min(2).max(200),email:z.string().email().max(254),phone:z.string().max(40).optional(),subject:z.string().max(120),message:z.string().trim().min(5).max(5000),consent:z.union([z.literal("true"),z.literal(true)]),website:z.string().max(0).optional(),recaptchaToken:z.string().optional()});
export async function POST(req:Request){try{const body=schema.parse(await req.json());if(body.website)return NextResponse.json({ok:true});if(!(await verifyRecaptcha(body.recaptchaToken,"contact")))return NextResponse.json({error:"recaptcha-failed"},{status:400});await db.insert(contacts).values({lang:body.lang,name:body.name,email:body.email,phone:body.phone,subject:body.subject,message:body.message,consent:true});
  const text=`Nuovo messaggio dal form di contatto\n\nNome: ${body.name}\nEmail: ${body.email}\nTelefono: ${body.phone||"—"}\nOggetto: ${body.subject}\n\n${body.message}`;
  const html=`<p><b>Nuovo messaggio dal form di contatto</b></p><p><b>Nome:</b> ${escapeHtml(body.name)}<br><b>Email:</b> ${escapeHtml(body.email)}<br><b>Telefono:</b> ${escapeHtml(body.phone||"—")}<br><b>Oggetto:</b> ${escapeHtml(body.subject)}</p><p style="white-space:pre-wrap">${escapeHtml(body.message)}</p>`;
  await sendMail({to:adminEmail(),replyTo:body.email,subject:`[Contatto sito] ${body.subject}`,text,html});
  return NextResponse.json({ok:true});}catch(e){console.error("Contact submission failed",e);return NextResponse.json({error:"Invalid request"},{status:400})}}
