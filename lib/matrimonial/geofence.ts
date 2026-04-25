const BLOCKED_COUNTRIES = new Set<string>([]);

export function isCountryBlocked(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return BLOCKED_COUNTRIES.has(countryCode.toUpperCase());
}
