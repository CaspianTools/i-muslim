import "server-only";

export interface TurnstileVerifyResult {
  success: boolean;
  reason?: string;
}

// Verifies a Cloudflare Turnstile token. When TURNSTILE_SECRET_KEY is unset,
// returns success — useful for local dev. Production deployments must set the key.
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
