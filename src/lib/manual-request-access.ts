import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { domiciliationRequests } from "@/db/schema";
import { CustomerError, digest } from "./customer-auth";

export const REQUEST_COOKIE = "ros_request_access";
export const REQUEST_OTP_CHALLENGE = (publicId: string) => `manual-request:${publicId}`;

/** The request belonging to this browser (httpOnly cookie set when the draft was created). */
export async function ownedRequest(req: NextRequest, requestId: string) {
  const raw = req.cookies.get(REQUEST_COOKIE)?.value;
  if (!raw || !/^[a-f\d]{64}$/.test(raw)) throw new CustomerError("request-session", 401);
  const [row] = await db.select().from(domiciliationRequests).where(and(eq(domiciliationRequests.publicId, requestId), eq(domiciliationRequests.tokenHash, digest(raw)))).limit(1);
  if (!row) throw new CustomerError("request-session", 401);
  return row;
}
