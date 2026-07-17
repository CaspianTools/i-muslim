import "server-only";

export interface TurnstileVerifyResult {
  success: boolean;
  reason?: string;
}

// Verifies a Cloudflare Turnstile token. Fail-open when TURNSTILE_SECRET_KEY is
// unset — this is intentional and load-bearing: the submit forms
// (SubmitMosqueForm / SubmitBusinessForm) do NOT yet render a Turnstile widget,
// so no client sends a token. Enabling the secret without first shipping the
// client challenge widget would make every submission fail `missing_token`
// (403) and block all mosque/business submissions. Until that widget exists,
// spam is backstopped by the submit routes' auth + honeypot + per-uid daily
// rate limit. To actually enable: (1) add the Turnstile widget + token to both
// forms, (2) provision TURNSTILE_SECRET_KEY in Secret Manager, (3) declare it
// in apphosting.yaml, then (4) fail-closed here.
export async function verifyTurnstile(token: string | null | undefined, ip?: string): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { success: true, reason: "turnstile_disabled" };
  if (!token) return { success: false, reason: "missing_token" };

  const body = new URLSearchParams();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
    });
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    if (data.success) return { success: true };
    return { success: false, reason: data["error-codes"]?.join(",") ?? "unknown" };
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : "network" };
  }
}
