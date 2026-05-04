// ISO 3166-1 alpha-2 country code → international calling code (without "+").
// Mirrors the country scope of lib/events/country-tz.ts. Used by the public
// business submit form to render a "+90 …" placeholder under the phone field
// once a country is picked.

const CALLING_CODES: Record<string, string> = {
  // Middle East
  SA: "966", AE: "971", QA: "974", KW: "965", BH: "973", OM: "968",
  IQ: "964", SY: "963", LB: "961", JO: "962", IL: "972", PS: "970",
  IR: "98",  YE: "967",

  // North Africa
  EG: "20",  SD: "249", LY: "218", TN: "216", DZ: "213", MA: "212",
  SO: "252", NG: "234", KE: "254", ZA: "27",  ET: "251", GH: "233",

  // Asia
  TR: "90",  PK: "92",  IN: "91",  BD: "880", ID: "62",  MY: "60",
  SG: "65",  TH: "66",  VN: "84",  PH: "63",  JP: "81",  KR: "82",
  CN: "86",  HK: "852", TW: "886", KZ: "7",   UZ: "998", AF: "93",
  AZ: "994",

  // Europe
  GB: "44",  IE: "353", FR: "33",  DE: "49",  IT: "39",  ES: "34",
  PT: "351", NL: "31",  BE: "32",  CH: "41",  AT: "43",  PL: "48",
  CZ: "420", SE: "46",  NO: "47",  DK: "45",  FI: "358", GR: "30",
  RU: "7",   UA: "380", RO: "40",  HU: "36",

  // Americas
  US: "1",   CA: "1",   MX: "52",  BR: "55",  AR: "54",  CL: "56",
  CO: "57",  PE: "51",  VE: "58",

  // Oceania
  AU: "61",  NZ: "64",
};

export function getCallingCode(countryCode: string | undefined | null): string | undefined {
  if (!countryCode) return undefined;
  return CALLING_CODES[countryCode.toUpperCase()];
}
