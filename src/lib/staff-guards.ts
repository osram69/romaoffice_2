import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_SESSION_COOKIE, getStaffUser, isOperational, roleHome, type StaffUser } from "./staff-auth";

const LOGIN_PATH = "/gestione-tariffe-x9k2m7/login";
const COMMERCIALISTA_PATH = "/commercialista-x9k2m7";

async function currentUser(basePath: string): Promise<StaffUser> {
  const store = await cookies();
  // getStaffUser is fail-closed: no session, expired, disabled or must-change-password all give null.
  const user = await getStaffUser(store.get(STAFF_SESSION_COOKIE)?.value);
  if (!user) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(basePath)}`);
  return user;
}

/** Pages and actions for admin and operatore. The commercialista is sent to their own page. */
export async function requireOperational(basePath: string): Promise<StaffUser> {
  const user = await currentUser(basePath);
  if (!isOperational(user.role)) redirect(roleHome(user.role));
  return user;
}

/** Admin only; operatore and commercialista go back to their own home. */
export async function requireAdminUser(basePath: string): Promise<StaffUser> {
  const user = await currentUser(basePath);
  if (user.role !== "admin") redirect(roleHome(user.role));
  return user;
}

/** The accountant download page: every other role is sent to their own home. */
export async function requireCommercialista(): Promise<StaffUser> {
  const user = await currentUser(COMMERCIALISTA_PATH);
  if (user.role !== "commercialista") redirect(roleHome(user.role));
  return user;
}
