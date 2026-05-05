import type {
  MatrimonialFilters,
  MatrimonialProfile,
  PrayerCommitment,
} from "@/types/matrimonial";
import { ageFromDob, ageInRange } from "./age";

const PRAYER_RANK: Record<PrayerCommitment, number> = {
  always: 5,
  mostly: 4,
  sometimes: 3,
  learning: 2,
  rarely: 1,
};

function meetsPrayerMin(c: PrayerCommitment, min: PrayerCommitment): boolean {
  return PRAYER_RANK[c] >= PRAYER_RANK[min];
}

export function mutualFilter(
  viewer: MatrimonialProfile,
  candidate: MatrimonialProfile,
): boolean {
  if (candidate.id === viewer.id) return false;
  if (candidate.status !== "active") return false;

  if (candidate.gender !== viewer.preferences.lookingForGender) return false;
  if (viewer.gender !== candidate.preferences.lookingForGender) return false;

  if (
    !ageInRange(
      candidate.dateOfBirth,
      viewer.preferences.ageMin,
      viewer.preferences.ageMax,
    )
  ) {
    return false;
  }

  const viewerAge = ageFromDob(viewer.dateOfBirth);
  if (
    viewerAge < candidate.preferences.ageMin ||
    viewerAge > candidate.preferences.ageMax
  ) {
    return false;
  }

  if (
    viewer.preferences.countries.length > 0 &&
    !viewer.preferences.countries.includes(candidate.country)
  ) {
    return false;
  }
  if (
    candidate.preferences.countries.length > 0 &&
    !candidate.preferences.countries.includes(viewer.country)
  ) {
    return false;
  }

  if (
    viewer.preferences.madhhabs.length > 0 &&
    !viewer.preferences.madhhabs.includes(candidate.madhhab)
  ) {
    return false;
  }
  if (
    candidate.preferences.madhhabs.length > 0 &&
    !candidate.preferences.madhhabs.includes(viewer.madhhab)
  ) {
    return false;
  }

  if (
    viewer.preferences.sects.length > 0 &&
    !viewer.preferences.sects.includes(candidate.sect)
  ) {
    return false;
  }
  if (
    candidate.preferences.sects.length > 0 &&
    !candidate.preferences.sects.includes(viewer.sect)
  ) {
    return false;
  }

  if (!meetsPrayerMin(candidate.prayerCommitment, viewer.preferences.prayerMin)) {
    return false;
  }
  if (!meetsPrayerMin(viewer.prayerCommitment, candidate.preferences.prayerMin)) {
    return false;
  }

  // polygamyAcceptable is the preferred polygamy stance for a match;
  // "na" acts as a wildcard (no filter), otherwise it must equal the
  // candidate's own stance.
  if (
    viewer.preferences.polygamyAcceptable !== "na" &&
    viewer.preferences.polygamyAcceptable !== candidate.polygamyStance
  ) {
    return false;
  }
  if (
    candidate.preferences.polygamyAcceptable !== "na" &&
    candidate.preferences.polygamyAcceptable !== viewer.polygamyStance
  ) {
    return false;
  }

  return true;
}

export function applyAdminFilters(
  profiles: MatrimonialProfile[],
  filters: MatrimonialFilters,
): MatrimonialProfile[] {
  return profiles.filter((p) => {
    if (filters.gender && p.gender !== filters.gender) return false;
    if (filters.status && p.status !== filters.status) return false;
    if (filters.country && p.country !== filters.country) return false;
    if (filters.madhhab && p.madhhab !== filters.madhhab) return false;
    if (filters.verifiedOnly && !p.verification.emailVerified) return false;
    if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
      const a = ageFromDob(p.dateOfBirth);
      if (filters.ageMin !== undefined && a < filters.ageMin) return false;
      if (filters.ageMax !== undefined && a > filters.ageMax) return false;
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      if (
        !p.displayName.toLowerCase().includes(q) &&
        !p.city.toLowerCase().includes(q) &&
        !p.country.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });
}
