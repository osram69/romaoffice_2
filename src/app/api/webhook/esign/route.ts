import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
export async function POST(req:Request){if(!process.env.ESIGN_WEBHOOK_SECRET)return NextResponse.json({error:"Webhook not configured"},{status:503});try{const raw=await req.text();const signature=req.headers.get("x-esign-signature")||"";const expected=createHmac("sha256",process.env.ESIGN_WEBHOOK_SECRET).update(raw).digest("hex");if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw new Error("Invalid signature");const event=JSON.parse(raw);if(event.type==="document.signed"&&event.orderId)await db.update(orders).set({status:"signed",signaturePath:event.secureDocumentKey,updatedAt:new Date()}).where(eq(orders.publicId,event.orderId));return NextResponse.json({received:true});}catch(e){console.error(e);return NextResponse.json({error:"Invalid webhook"},{status:400})}}
