import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contacts } from "@/db/schema";
const schema=z.object({lang:z.enum(["it","en"]).default("it"),name:z.string().trim().min(2).max(200),email:z.string().email().max(254),phone:z.string().max(40).optional(),subject:z.string().max(120),message:z.string().trim().min(5).max(5000),consent:z.union([z.literal("true"),z.literal(true)]),website:z.string().max(0).optional()});
export async function POST(req:Request){try{const body=schema.parse(await req.json());if(body.website)return NextResponse.json({ok:true});await db.insert(contacts).values({lang:body.lang,name:body.name,email:body.email,phone:body.phone,subject:body.subject,message:body.message,consent:true});return NextResponse.json({ok:true});}catch(e){console.error("Contact submission failed",e);return NextResponse.json({error:"Invalid request"},{status:400})}}
