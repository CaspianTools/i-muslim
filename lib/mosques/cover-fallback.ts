/**
 * Royalty-free fallback cover photos. Picked deterministically per masjid so a
 * mosque without an uploaded cover still gets a real, stable photo rather than a
 * bare gradient.
 *
 * Every entry is a full image URL on a host already allowed in `next.config.ts`
 * (`upload.wikimedia.org`, `images.unsplash.com`) and has been **content-verified
 * to actually depict a mosque** — not merely verified to resolve. (The previous
 * list was only checked for resolution, which let a Christmas/stock photo slip
 * in for some slugs.) Wikimedia entries are freely licensed (CC BY / CC BY-SA);
 * the mosque + city is noted inline for traceability.
 */
const FALLBACK_COVER_URLS = [
  // Sultan Salahuddin Abdul Aziz "Blue" Mosque — Shah Alam, Malaysia (Unsplash)
  "https://images.unsplash.com/photo-1519817650390-64a93db51149?w=1600&q=80&auto=format&fit=crop",
  // Sultan Ahmed (Blue) Mosque — Istanbul, Turkey (Wikimedia, CC BY-SA)
  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Exterior_of_Sultan_Ahmed_I_Mosque_in_Istanbul%2C_Turkey_002.jpg/1920px-Exterior_of_Sultan_Ahmed_I_Mosque_in_Istanbul%2C_Turkey_002.jpg",
  // Çamlıca Mosque at sunset — Istanbul, Turkey (Wikimedia, CC BY-SA)
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Exterior_of_the_%C3%87aml%C4%B1ca_Mosque_%282024%29.jpg/1920px-Exterior_of_the_%C3%87aml%C4%B1ca_Mosque_%282024%29.jpg",
  // Kocatepe Mosque — Ankara, Turkey (Wikimedia, CC BY-SA)
  "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Ankara_Kocatepe_Mosque_Exterior_in_2003_01.jpg/1920px-Ankara_Kocatepe_Mosque_Exterior_in_2003_01.jpg",
  // Muradiye Mosque portico — Bursa, Turkey (Wikimedia, CC BY-SA)
  "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Bursa_Muradiye_Mosque_Exterior_8040.jpg/1920px-Bursa_Muradiye_Mosque_Exterior_8040.jpg",
  // Sheikh Zayed Grand Mosque silhouette — Abu Dhabi, UAE (Wikimedia, CC BY-SA)
  "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Sheikh_Zayed_Mosque_Silhouette.jpg/1920px-Sheikh_Zayed_Mosque_Silhouette.jpg",
  // Badshahi Mosque — Lahore, Pakistan (Wikimedia, CC BY-SA)
  "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Badshahi_Mosque%2C_Lahore_I.jpg/1920px-Badshahi_Mosque%2C_Lahore_I.jpg",
  // Faisal Mosque — Islamabad, Pakistan (Wikimedia, CC BY-SA)
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/National_Faisal_Mosque_Islamabad.jpg/1920px-National_Faisal_Mosque_Islamabad.jpg",
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function coverFallbackUrl(slug: string): string {
  return FALLBACK_COVER_URLS[hashSlug(slug) % FALLBACK_COVER_URLS.length];
}
