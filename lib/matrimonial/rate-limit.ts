import type { MatrimonialProfile, SubscriptionTier } from "@/types/matrimonial";

export const DAILY_INTEREST_CAP: Record<SubscriptionTier, number> = {
  free: 10,
  premium: 50,
};

export function nextMidnightUtc(now: Date = new Date()): string {
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
  return next.toISOString();
}

export interface RateLimitCheck {
  ok: boolean;
  remaining: number;
  resetsAt: string;
  cap: number;
}

export function canExpressInterest(
  profile: Pick<MatrimonialProfile, "subscription" | "rateLimit">,
  now: Date = new Date(),
): RateLimitCheck {
  const cap = DAILY_INTEREST_CAP[profile.subscription.tier];
  const resetAt = new Date(profile.rateLimit.dailyInterestsResetAt);
  const expired = Number.isNaN(resetAt.getTime()) || now >= resetAt;

  const used = expired ? 0 : profile.rateLimit.dailyInterestsUsed;
  const resetsAt = expired ? nextMidnightUtc(now) : profile.rateLimit.dailyInterestsResetAt;
  const remaining = Math.max(0, cap - used);

  return {
    ok: remaining > 0,
    remaining,
    resetsAt,
    cap,
  };
}

export function applyInterestUse(
  profile: Pick<MatrimonialProfile, "rateLimit">,
  now: Date = new Date(),
): MatrimonialProfile["rateLimit"] {
  const resetAt = new Date(profile.rateLimit.dailyInterestsResetAt);
  const expired = Number.isNaN(resetAt.getTime()) || now >= resetAt;
  return {
    dailyInterestsUsed: (expired ? 0 : profile.rateLimit.dailyInterestsUsed) + 1,
    dailyInterestsResetAt: expired
      ? nextMidnightUtc(now)
      : profile.rateLimit.dailyInterestsResetAt,
  };
}
