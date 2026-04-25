import type { Mazhab, UserSettings } from "./types";

type Preset = Pick<
  UserSettings,
  "nisabSource" | "jewelryExempt" | "goldNisabGrams" | "silverNisabGrams"
>;

export const MAZHAB_PRESETS: Record<Exclude<Mazhab, "custom">, Preset> = {
  hanafi: {
    nisabSource: "gold",
    jewelryExempt: false,
    goldNisabGrams: 87.48,
    silverNisabGrams: 612.36,
  },
  maliki: {
    nisabSource: "gold",
    jewelryExempt: true,
    goldNisabGrams: 85,
    silverNisabGrams: 595,
  },
  shafii: {
    nisabSource: "gold",
    jewelryExempt: true,
    goldNisabGrams: 85,
    silverNisabGrams: 595,
  },
  hanbali: {
    nisabSource: "gold",
    jewelryExempt: true,
    goldNisabGrams: 85,
    silverNisabGrams: 595,
  },
};

export const MAZHABS: readonly Mazhab[] = [
  "hanafi",
  "maliki",
  "shafii",
  "hanbali",
  "custom",
] as const;

export function presetFor(mazhab: Mazhab): UserSettings {
  if (mazhab === "custom") {
    return {
      mazhab: "custom",
      ...MAZHAB_PRESETS.hanafi,
    };
  }
  return { mazhab, ...MAZHAB_PRESETS[mazhab] };
}
