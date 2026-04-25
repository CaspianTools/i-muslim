export interface Currency {
  code: string;
  symbol: string;
}

export const CURRENCIES: readonly Currency[] = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "SAR", symbol: "﷼" },
  { code: "AED", symbol: "د.إ" },
  { code: "TRY", symbol: "₺" },
  { code: "PKR", symbol: "₨" },
  { code: "INR", symbol: "₹" },
  { code: "BDT", symbol: "৳" },
  { code: "EGP", symbol: "E£" },
  { code: "IDR", symbol: "Rp" },
  { code: "MYR", symbol: "RM" },
  { code: "KES", symbol: "KSh" },
  { code: "NGN", symbol: "₦" },
  { code: "CAD", symbol: "C$" },
  { code: "AUD", symbol: "A$" },
  { code: "QAR", symbol: "﷼" },
  { code: "KWD", symbol: "د.ك" },
  { code: "BHD", symbol: ".د.ب" },
  { code: "OMR", symbol: "﷼" },
] as const;

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function findCurrency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}
