export type Mazhab = "hanafi" | "maliki" | "shafii" | "hanbali" | "custom";

export type NisabSource = "gold" | "silver" | "auto";

export interface UserSettings {
  mazhab: Mazhab;
  nisabSource: NisabSource;
  jewelryExempt: boolean;
  goldNisabGrams: number;
  silverNisabGrams: number;
}

export interface CurrencyEntry {
  id: string;
  amount: number;
  currency: string;
  rate: number;
}

export interface ReceivableEntry extends CurrencyEntry {
  name: string;
}

export interface GenericEntry {
  id: string;
  label: string;
  value: number;
}

export interface ZakatState {
  settings: UserSettings;
  goldPrice: number;
  silverPrice: number;
  goldWeight: number;
  silverWeight: number;
  cash: CurrencyEntry[];
  bank: CurrencyEntry[];
  receivables: ReceivableEntry[];
  investments: GenericEntry[];
  business: GenericEntry[];
  liabilities: GenericEntry[];
}

export interface BreakdownItem {
  id: string;
  titleKey: string;
  value: number;
}

export interface Totals {
  positiveAssets: number;
  totalLiabilities: number;
  netWealth: number;
  zakatDue: number;
  preciousTotal: number;
  goldValue: number;
  silverValue: number;
  breakdown: BreakdownItem[];
  liabilityItems: GenericEntry[];
}

export interface RatesResponse {
  fx: Record<string, number>;
  gold: number | null;
  silver: number | null;
  fetchedAt: string;
}
