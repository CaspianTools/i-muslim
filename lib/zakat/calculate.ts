import type {
  CurrencyEntry,
  GenericEntry,
  Totals,
  UserSettings,
  ZakatState,
} from "./types";

export const ZAKAT_RATE = 0.025;

export function totalCurrencyInUSD(entries: CurrencyEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount * e.rate, 0);
}

export function totalGenericValue(entries: GenericEntry[]): number {
  return entries.reduce((sum, e) => sum + e.value, 0);
}

export function computeTotals(state: ZakatState): Totals {
  const cash = totalCurrencyInUSD(state.cash);
  const bank = totalCurrencyInUSD(state.bank);
  const receivables = totalCurrencyInUSD(state.receivables);
  const investments = totalGenericValue(state.investments);
  const business = totalGenericValue(state.business);
  const liabilitiesSum = totalGenericValue(state.liabilities);

  let goldValue = state.goldWeight * state.goldPrice;
  let silverValue = state.silverWeight * state.silverPrice;
  if (state.settings.jewelryExempt) {
    goldValue = 0;
    silverValue = 0;
  }
  const preciousTotal = goldValue + silverValue;

  const breakdown = [
    { id: "cash", titleKey: "breakdown.cash", value: cash },
    { id: "bank", titleKey: "breakdown.bank", value: bank },
    { id: "receivables", titleKey: "breakdown.receivables", value: receivables },
    { id: "investments", titleKey: "breakdown.investments", value: investments },
    { id: "business", titleKey: "breakdown.business", value: business },
  ];

  const positiveAssets =
    cash + bank + receivables + investments + business + preciousTotal;
  const netWealth = Math.max(0, positiveAssets - liabilitiesSum);
  const zakatDue = netWealth * ZAKAT_RATE;
  const liabilityItems = state.liabilities.filter((l) => l.value > 0);

  return {
    positiveAssets,
    totalLiabilities: liabilitiesSum,
    netWealth,
    zakatDue,
    preciousTotal,
    goldValue,
    silverValue,
    breakdown,
    liabilityItems,
  };
}

export interface NisabBreakdown {
  value: number;
  grams: number;
  metal: "gold" | "silver";
}

export function computeNisab(
  settings: UserSettings,
  goldPrice: number,
  silverPrice: number,
): NisabBreakdown {
  const goldNisab = goldPrice * settings.goldNisabGrams;
  const silverNisab = silverPrice * settings.silverNisabGrams;
  const useGold =
    settings.nisabSource === "gold" ||
    (settings.nisabSource === "auto" && goldNisab <= silverNisab);
  return useGold
    ? { value: goldNisab, grams: settings.goldNisabGrams, metal: "gold" }
    : { value: silverNisab, grams: settings.silverNisabGrams, metal: "silver" };
}

export function isZakatDue(netWealth: number, nisab: number): boolean {
  return netWealth >= nisab;
}

export function formatUSD(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale ?? "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatGrams(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale ?? "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
