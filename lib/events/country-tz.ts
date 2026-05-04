// ISO 3166-1 alpha-2 country code → primary IANA timezone.
// Used by the public event submission form to suggest a timezone after
// the submitter picks a venue country. Falls back to undefined for
// unmapped countries — the form keeps whatever the user (or Intl) chose.

const COUNTRY_TO_TZ: Record<string, string> = {
  // Middle East
  SA: "Asia/Riyadh",
  AE: "Asia/Dubai",
  QA: "Asia/Qatar",
  KW: "Asia/Kuwait",
  BH: "Asia/Bahrain",
  OM: "Asia/Muscat",
  IQ: "Asia/Baghdad",
  SY: "Asia/Damascus",
  LB: "Asia/Beirut",
  JO: "Asia/Amman",
  IL: "Asia/Jerusalem",
  PS: "Asia/Hebron",
  IR: "Asia/Tehran",
  YE: "Asia/Aden",

  // North Africa
  EG: "Africa/Cairo",
  SD: "Africa/Khartoum",
  LY: "Africa/Tripoli",
  TN: "Africa/Tunis",
  DZ: "Africa/Algiers",
  MA: "Africa/Casablanca",
  SO: "Africa/Mogadishu",
  NG: "Africa/Lagos",
  KE: "Africa/Nairobi",
  ZA: "Africa/Johannesburg",
  ET: "Africa/Addis_Ababa",
  GH: "Africa/Accra",

  // Asia
  TR: "Europe/Istanbul",
  PK: "Asia/Karachi",
  IN: "Asia/Kolkata",
  BD: "Asia/Dhaka",
  ID: "Asia/Jakarta",
  MY: "Asia/Kuala_Lumpur",
  SG: "Asia/Singapore",
  TH: "Asia/Bangkok",
  VN: "Asia/Ho_Chi_Minh",
  PH: "Asia/Manila",
  JP: "Asia/Tokyo",
  KR: "Asia/Seoul",
  CN: "Asia/Shanghai",
  HK: "Asia/Hong_Kong",
  TW: "Asia/Taipei",
  KZ: "Asia/Almaty",
  UZ: "Asia/Tashkent",
  AF: "Asia/Kabul",
  AZ: "Asia/Baku",

  // Europe
  GB: "Europe/London",
  IE: "Europe/Dublin",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  CH: "Europe/Zurich",
  AT: "Europe/Vienna",
  PL: "Europe/Warsaw",
  CZ: "Europe/Prague",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki",
  GR: "Europe/Athens",
  RU: "Europe/Moscow",
  UA: "Europe/Kyiv",
  RO: "Europe/Bucharest",
  HU: "Europe/Budapest",

  // Americas
  US: "America/New_York",
  CA: "America/Toronto",
  MX: "America/Mexico_City",
  BR: "America/Sao_Paulo",
  AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago",
  CO: "America/Bogota",
  PE: "America/Lima",
  VE: "America/Caracas",

  // Oceania
  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
};

export function suggestTimezoneForCountry(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  return COUNTRY_TO_TZ[code.toUpperCase()];
}
