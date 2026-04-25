import type { MatrimonialPhoto, MatrimonialProfile } from "@/types/matrimonial";

export function getVisiblePhotos(
  profile: Pick<MatrimonialProfile, "photos">,
  viewerHasMatch: boolean,
): MatrimonialPhoto[] {
  if (!viewerHasMatch) return [];
  return profile.photos;
}

export function maxPhotosFor(
  verification: Pick<MatrimonialProfile["verification"], "photoVerified">,
): number {
  return verification.photoVerified ? 6 : 3;
}
