import { NextResponse } from "next/server";
import type { RatesResponse } from "@/lib/zakat/types";

export const revalidate = 3600;

interface OpenErApi {
  result?: string;
  rates?: Record<string, number>;
}

interface MetalsDevApi {
  status?: string;
  metals?: { gold?: number; silver?: number };
}

async function fetchFx(): Promise<Record<string, number>> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`FX upstream returned ${res.status}`);
  const data: OpenErApi = await res.json();
  if (data.result !== "success" || !data.rates) {
    throw new Error("FX upstream returned no rates");
  }
  // upstream gives "1 USD = X foreign". Calculator wants "1 foreign = Y USD".
  const inverted: Record<string, number> = {};
  for (const [code, perUsd] of Object.entries(data.rates)) {
    if (perUsd > 0) inverted[code] = 1 / perUsd;
  }
  return inverted;
}

async function fetchMetals(
  apiKey: string,
): Promise<{ gold: number | null; silver: number | null }> {
  const url = `https://api.metals.dev/v1/latest?api_key=${encodeURIComponent(apiKey)}&currency=USD&unit=g`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Metals upstream returned ${res.status}`);
  const data: MetalsDevApi = await res.json();
  return {
    gold: data.metals?.gold ?? null,
    silver: data.metals?.silver ?? null,
  };
}

export async function GET(): Promise<NextResponse<RatesResponse>> {
  const fxResult = await fetchFx().catch((err) => {
    console.error("zakat rates: fx fetch failed", err);
    return {} as Record<string, number>;
  });

  const metalsKey = process.env.METALS_DEV_API_KEY;
  const metalsResult = metalsKey
    ? await fetchMetals(metalsKey).catch((err) => {
        console.error("zakat rates: metals fetch failed", err);
        return { gold: null, silver: null };
      })
    : { gold: null, silver: null };

  return NextResponse.json({
    fx: fxResult,
    gold: metalsResult.gold,
    silver: metalsResult.silver,
    fetchedAt: new Date().toISOString(),
  });
}
