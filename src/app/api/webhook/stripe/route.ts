import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
export async function POST(req:Request){if(!process.env.STRIPE_SECRET||!process.env.STRIPE_WEBHOOK_SECRET)return NextResponse.json({error:"Webhook not configured"},{status:503});try{const stripe=new Stripe(process.env.STRIPE_SECRET);const raw=await req.text();const event=stripe.webhooks.constructEvent(raw,req.headers.get("stripe-signature")||"",process.env.STRIPE_WEBHOOK_SECRET);if(event.type==="checkout.session.completed"){const s=event.data.object;const orderId=s.metadata?.orderId;if(orderId)await db.update(orders).set({status:"paid",provider:"stripe",providerReference:s.id,updatedAt:new Date()}).where(eq(orders.publicId,orderId));}return NextResponse.json({received:true});}catch(e){console.error("Stripe webhook rejected",e);return NextResponse.json({error:"Invalid signature"},{status:400})}}
