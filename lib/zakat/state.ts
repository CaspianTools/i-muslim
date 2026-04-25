import type {
  CurrencyEntry,
  GenericEntry,
  Mazhab,
  ReceivableEntry,
  UserSettings,
  ZakatState,
} from "./types";
import { presetFor } from "./mazhab";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

export type CurrencyBucket = "cash" | "bank";
export type GenericBucket = "investments" | "business" | "liabilities";

export type Action =
  | { type: "SET_GOLD_PRICE"; value: number }
  | { type: "SET_SILVER_PRICE"; value: number }
  | { type: "SET_GOLD_WEIGHT"; value: number }
  | { type: "SET_SILVER_WEIGHT"; value: number }
  | { type: "SET_SETTINGS"; settings: UserSettings }
  | { type: "SET_MAZHAB"; mazhab: Mazhab }
  | { type: "ADD_CURRENCY"; bucket: CurrencyBucket }
  | {
      type: "UPDATE_CURRENCY";
      bucket: CurrencyBucket;
      id: string;
      updates: Partial<CurrencyEntry>;
    }
  | { type: "REMOVE_CURRENCY"; bucket: CurrencyBucket; id: string }
  | { type: "ADD_RECEIVABLE" }
  | { type: "UPDATE_RECEIVABLE"; id: string; updates: Partial<ReceivableEntry> }
  | { type: "REMOVE_RECEIVABLE"; id: string }
  | { type: "ADD_GENERIC"; bucket: GenericBucket }
  | {
      type: "UPDATE_GENERIC";
      bucket: GenericBucket;
      id: string;
      updates: Partial<GenericEntry>;
    }
  | { type: "REMOVE_GENERIC"; bucket: GenericBucket; id: string }
  | {
      type: "APPLY_RATES";
      fx: Record<string, number>;
      gold: number | null;
      silver: number | null;
    }
  | { type: "RESET" }
  | { type: "HYDRATE"; state: ZakatState };

export const initialState: ZakatState = {
  settings: presetFor("hanafi"),
  goldPrice: 65,
  silverPrice: 0.85,
  goldWeight: 0,
  silverWeight: 0,
  cash: [{ id: "1", amount: 0, currency: "USD", rate: 1 }],
  bank: [{ id: "1", amount: 0, currency: "USD", rate: 1 }],
  receivables: [{ id: "1", name: "", amount: 0, currency: "USD", rate: 1 }],
  investments: [
    { id: "1", label: "investments.shares", value: 0 },
    { id: "2", label: "investments.pension", value: 0 },
    { id: "3", label: "investments.crypto", value: 0 },
  ],
  business: [
    { id: "1", label: "business.stockForTrade", value: 0 },
    { id: "2", label: "business.cash", value: 0 },
  ],
  liabilities: [
    { id: "1", label: "liabilities.personalDebts", value: 0 },
    { id: "2", label: "liabilities.immediateExpenses", value: 0 },
  ],
};

function updateCurrencyList<T extends CurrencyEntry>(
  list: T[],
  id: string,
  updates: Partial<T>,
): T[] {
  return list.map((e) => (e.id === id ? { ...e, ...updates } : e));
}

export function reducer(state: ZakatState, action: Action): ZakatState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;
    case "SET_GOLD_PRICE":
      return { ...state, goldPrice: action.value };
    case "SET_SILVER_PRICE":
      return { ...state, silverPrice: action.value };
    case "SET_GOLD_WEIGHT":
      return { ...state, goldWeight: action.value };
    case "SET_SILVER_WEIGHT":
      return { ...state, silverWeight: action.value };
    case "SET_SETTINGS":
      return { ...state, settings: action.settings };
    case "SET_MAZHAB":
      return { ...state, settings: presetFor(action.mazhab) };
    case "ADD_CURRENCY":
      return {
        ...state,
        [action.bucket]: [
          ...state[action.bucket],
          { id: newId(), amount: 0, currency: "USD", rate: 1 },
        ],
      };
    case "UPDATE_CURRENCY":
      return {
        ...state,
        [action.bucket]: updateCurrencyList(
          state[action.bucket],
          action.id,
          action.updates,
        ),
      };
    case "REMOVE_CURRENCY": {
      const list = state[action.bucket];
      if (list.length <= 1) return state;
      return {
        ...state,
        [action.bucket]: list.filter((e) => e.id !== action.id),
      };
    }
    case "ADD_RECEIVABLE":
      return {
        ...state,
        receivables: [
          ...state.receivables,
          { id: newId(), name: "", amount: 0, currency: "USD", rate: 1 },
        ],
      };
    case "UPDATE_RECEIVABLE":
      return {
        ...state,
        receivables: updateCurrencyList(
          state.receivables,
          action.id,
          action.updates,
        ),
      };
    case "REMOVE_RECEIVABLE": {
      if (state.receivables.length <= 1) {
        return {
          ...state,
          receivables: [
            { id: "1", name: "", amount: 0, currency: "USD", rate: 1 },
          ],
        };
      }
      return {
        ...state,
        receivables: state.receivables.filter((e) => e.id !== action.id),
      };
    }
    case "ADD_GENERIC":
      return {
        ...state,
        [action.bucket]: [
          ...state[action.bucket],
          { id: newId(), label: "", value: 0 },
        ],
      };
    case "UPDATE_GENERIC":
      return {
        ...state,
        [action.bucket]: state[action.bucket].map((e) =>
          e.id === action.id ? { ...e, ...action.updates } : e,
        ),
      };
    case "REMOVE_GENERIC": {
      const list = state[action.bucket];
      if (list.length <= 1) {
        return {
          ...state,
          [action.bucket]: [{ id: "1", label: "", value: 0 }],
        };
      }
      return {
        ...state,
        [action.bucket]: list.filter((e) => e.id !== action.id),
      };
    }
    case "APPLY_RATES": {
      const applyToList = <T extends CurrencyEntry>(list: T[]): T[] =>
        list.map((entry) => {
          if (entry.currency === "USD") return entry;
          const rate = action.fx[entry.currency.toUpperCase()];
          return rate ? { ...entry, rate } : entry;
        });
      return {
        ...state,
        cash: applyToList(state.cash),
        bank: applyToList(state.bank),
        receivables: applyToList(state.receivables),
        goldPrice: action.gold ?? state.goldPrice,
        silverPrice: action.silver ?? state.silverPrice,
      };
    }
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export const STORAGE_KEY = "i-muslim:zakat-state:v1";
