// Browser side of reCAPTCHA v3, kept free of DOM and React so it can be tested on its own.
// Whatever goes wrong (Google rejecting the site key, the script never answering, a blocked
// request) it settles with `undefined` instead of leaving the caller waiting: the contact form
// used to spin forever because grecaptcha.execute throws synchronously on an invalid key.
export const RECAPTCHA_TIMEOUT_MS = 8000;

export type GrecaptchaClient = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

export function runRecaptcha(
  client: GrecaptchaClient,
  siteKey: string,
  action: string,
  timeoutMs: number = RECAPTCHA_TIMEOUT_MS,
): Promise<string | undefined> {
  return new Promise<string | undefined>(resolve => {
    let settled = false;
    const finish = (token: string | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(token);
    };
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    try {
      client.ready(() => {
        try {
          client.execute(siteKey, { action }).then(token => finish(typeof token === "string" && token ? token : undefined), () => finish(undefined));
        } catch {
          finish(undefined);
        }
      });
    } catch {
      finish(undefined);
    }
  });
}
