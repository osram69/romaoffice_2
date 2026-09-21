/**
 * Verifies a Google reCAPTCHA v3 token server-side. Fails open (allows the request) when
 * RECAPTCHA_SECRET_KEY isn't set, so local/dev environments without the key keep working; fails
 * closed only on an explicit "not a human" verdict from Google, not on a network hiccup talking
 * to Google itself (a spam-prevention layer must never be the reason a genuine enquiry is lost).
 */
export async function verifyRecaptcha(token: string | undefined | null, action: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    if (data.success !== true) return false;
    if (data.action && data.action !== action) return false;
    if (typeof data.score === "number" && data.score < 0.5) return false;
    return true;
  } catch (error) {
    console.error("reCAPTCHA verification unreachable, allowing submission", error instanceof Error ? error.message : error);
    return true;
  }
}
