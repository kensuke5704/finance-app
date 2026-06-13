import { NextResponse } from "next/server";

type YahooChartQuote = {
  close?: unknown;
};

type YahooChartResult = {
  meta?: {
    regularMarketPrice?: unknown;
  };
  indicators?: {
    quote?: YahooChartQuote[];
  };
};

type YahooChartResponse = {
  chart?: {
    result?: YahooChartResult[] | null;
  };
};

function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function fundCandidates(code: string) {
  const normalized = normalizeCode(code).toUpperCase();
  if (!normalized) return [];
  if (normalized.includes(".")) return [normalized];
  return [normalized, `${normalized}.T`];
}

function extractYahooChartPrice(data: unknown) {
  const result = (data as YahooChartResponse).chart?.result?.[0];
  const metaPrice = result?.meta?.regularMarketPrice;
  if (typeof metaPrice === "number" && Number.isFinite(metaPrice)) {
    return metaPrice;
  }

  const closes = result?.indicators?.quote?.[0]?.close;
  if (Array.isArray(closes)) {
    const latest = [...closes]
      .reverse()
      .find((value) => typeof value === "number" && Number.isFinite(value));
    if (typeof latest === "number") return latest;
  }

  return null;
}

async function fetchYahooPrice(symbol: string) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
    {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) return null;
  return extractYahooChartPrice(await response.json());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = normalizeCode(url.searchParams.get("code") ?? "");
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  for (const candidate of fundCandidates(code)) {
    try {
      const price = await fetchYahooPrice(candidate);
      if (typeof price === "number" && Number.isFinite(price)) {
        return NextResponse.json({ price, symbol: candidate });
      }
    } catch {
      // try next candidate
    }
  }

  return NextResponse.json(
    { error: "price not found" },
    { status: 404 },
  );
}
