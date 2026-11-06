"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, login, postLoginPath, staffLoginAllowed, STAFF_SESSION_COOKIE, STAFF_SESSION_SECONDS } from "./staff-auth";

const LOGIN_PATH = "/gestione-tariffe-x9k2m7/login";

export async function staffLoginAction(_prevState: { error: boolean }, formData: FormData) {
  "use server";
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || "/gestione-domiciliazioni-x9k2m7";
  // Too many attempts for this user name looks exactly like a wrong password.
  if (!(await staffLoginAllowed(username))) return { error: true };
  const user = await login(username, password);
  if (!user) return { error: true };
  const raw = await createSession(user.id);
  const store = await cookies();
  store.set(STAFF_SESSION_COOKIE, raw, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: STAFF_SESSION_SECONDS });
  redirect(postLoginPath(user, next));
}

export async function staffLogoutAction() {
  "use server";
  const store = await cookies();
  await destroySession(store.get(STAFF_SESSION_COOKIE)?.value);
  store.delete(STAFF_SESSION_COOKIE);
  redirect(LOGIN_PATH);
}
