"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_SESSION_COOKIE, getStaffUser, roleHome } from "@/lib/staff-auth";
import { performPasswordChange, type PasswordChangeState } from "./change";

const LOGIN_PATH = "/gestione-tariffe-x9k2m7/login";

export async function changePasswordAction(_prev: PasswordChangeState, formData: FormData): Promise<PasswordChangeState> {
  const store = await cookies();
  const raw = store.get(STAFF_SESSION_COOKIE)?.value;
  // Users who must change their password are allowed here (and only here).
  const user = await getStaffUser(raw, { allowMustChange: true });
  if (!user || !raw) redirect(LOGIN_PATH);
  const result = await performPasswordChange(user, raw, {
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!result.done) return result;
  redirect(roleHome(user.role));
}
