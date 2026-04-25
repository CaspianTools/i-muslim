import "server-only";
import type {
  MatrimonialInterest,
  MatrimonialProfile,
  MatrimonialReport,
  MatrimonialStats,
} from "@/types/matrimonial";

const DAY_MS = 86_400_000;

export function computeMatrimonialStats(
  profiles: MatrimonialProfile[],
  interests: MatrimonialInterest[],
  reports: MatrimonialReport[],
): MatrimonialStats {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * DAY_MS;

  const accepted = interests.filter((i) => i.status === "accepted");
  const matchedPairs = new Set<string>();
  for (const a of accepted) {
    const reverse = accepted.find(
      (b) => b.fromUserId === a.toUserId && b.toUserId === a.fromUserId,
    );
    if (!reverse) continue;
    const respondedAt = a.respondedAt ? new Date(a.respondedAt).getTime() : 0;
    if (respondedAt >= sevenDaysAgo) {
      const key = [a.fromUserId, a.toUserId].sort().join("|");
      matchedPairs.add(key);
    }
  }

  const growth30d: Array<{ date: string; profiles: number }> = [];
  for (let d = 29; d >= 0; d--) {
    const dayStart = now - d * DAY_MS;
    const date = new Date(dayStart).toISOString().slice(0, 10);
    const count = profiles.filter(
      (p) => new Date(p.createdAt).getTime() <= dayStart,
    ).length;
    growth30d.push({ date, profiles: count });
  }

  return {
    activeProfiles: profiles.filter((p) => p.status === "active").length,
    pendingProfiles: profiles.filter((p) => p.status === "pending").length,
    matchesThisWeek: matchedPairs.size,
    openReports: reports.filter((r) => r.status === "open").length,
    growth30d,
  };
}
