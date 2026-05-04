// Best-effort browser-IANA-timezone → ISO 3166-1 alpha-2 mapping.
// Used to silently prefill the country combobox on the public business
// submit form when no other signal is available.
//
// Mirrors the country scope of lib/events/country-tz.ts (one tz per
// country); doesn't pretend to cover every IANA zone.

const TZ_TO_COUNTRY: Record<string, string> = {
  // Middle East
  "Asia/Riyadh": "SA", "Asia/Dubai": "AE", "Asia/Qatar": "QA",
  "Asia/Kuwait": "KW", "Asia/Bahrain": "BH", "Asia/Muscat": "OM",
  "Asia/Baghdad": "IQ", "Asia/Damascus": "SY", "Asia/Beirut": "LB",
  "Asia/Amman": "JO", "Asia/Jerusalem": "IL", "Asia/Hebron": "PS",
  "Asia/Tehran": "IR", "Asia/Aden": "YE",

  // North Africa + Africa
  "Africa/Cairo": "EG", "Africa/Khartoum": "SD", "Africa/Tripoli": "LY",
  "Africa/Tunis": "TN", "Africa/Algiers": "DZ", "Africa/Casablanca": "MA",
  "Africa/Mogadishu": "SO", "Africa/Lagos": "NG", "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA", "Africa/Addis_Ababa": "ET", "Africa/Accra": "GH",

  // Asia
  "Europe/Istanbul": "TR", "Asia/Karachi": "PK", "Asia/Kolkata": "IN",
  "Asia/Dhaka": "BD", "Asia/Jakarta": "ID", "Asia/Kuala_Lumpur": "MY",
  "Asia/Singapore": "SG", "Asia/Bangkok": "TH", "Asia/Ho_Chi_Minh": "VN",
  "Asia/Manila": "PH", "Asia/Tokyo": "JP", "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW",
  "Asia/Almaty": "KZ", "Asia/Tashkent": "UZ", "Asia/Kabul": "AF",
  "Asia/Baku": "AZ",

  // Europe
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR",
  "Europe/Berlin": "DE", "Europe/Rome": "IT", "Europe/Madrid": "ES",
  "Europe/Lisbon": "PT", "Europe/Amsterdam": "NL", "Europe/Brussels": "BE",
  "Europe/Zurich": "CH", "Europe/Vienna": "AT", "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ", "Europe/Stockholm": "SE", "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI", "Europe/Athens": "GR",
  "Europe/Moscow": "RU", "Europe/Kyiv": "UA", "Europe/Bucharest": "RO",
  "Europe/Budapest": "HU",

  // Americas
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US",
  "America/Toronto": "CA", "America/Vancouver": "CA",
  "America/Mexico_City": "MX", "America/Sao_Paulo": "BR",
  "America/Argentina/Buenos_Aires": "AR", "America/Santiago": "CL",
  "America/Bogota": "CO", "America/Lima": "PE", "America/Caracas": "VE",

  // Oceania
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Perth": "AU",
  "Pacific/Auckland": "NZ",
};

export function suggestCountryForTimezone(tz: string | undefined | null): string | undefined {
  if (!tz) return undefined;
  return TZ_TO_COUNTRY[tz];
}
