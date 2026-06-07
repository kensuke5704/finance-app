import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FundQuoteResponse = {
  code: string;
  name: string | null;
  price: number | null;
  date: string | null;
};

function parseNumber(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(/[,円\s]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function stripTags(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function extractName(html: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!titleMatch) return null;
  const title = stripTags(titleMatch[1]).replace(/【投資信託】.*$/, "").replace(/ - Yahoo!ファイナンス.*$/, "").trim();
  return title || null;
}

function extractPrice(html: string) {
  const text = stripTags(html);
  const patterns = [
    /基準価額\s*[：:]?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*円/,
    /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*円\s*(?:前日比|--|[-+±▲▼])/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = parseNumber(match?.[1]);
    if (parsed) return parsed;
  }

  const jsonPatterns = [
    /"regularMarketPrice"\s*:\s*\{[^}]*"raw"\s*:\s*([0-9.]+)/,
    /"price"\s*:\s*\{[^}]*"raw"\s*:\s*([0-9.]+)/,
    /"nav"\s*:\s*\{[^}]*"raw"\s*:\s*([0-9.]+)/,
  ];
  for (const pattern of jsonPatterns) {
    const match = html.match(pattern);
    const parsed = parseNumber(match?.[1]);
    if (parsed) return parsed;
  }
  return null;
}

function extractDate(html: string) {
  const text = stripTags(html);
  const match = text.match(/([0-9]{1,2}\/[0-9]{1,2})\s*(?:現在|更新|時点)?/);
  return match?.[1] ?? null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCode = searchParams.get("code") ?? "";
  const code = rawCode.trim().replace(/\s+/g, "");

  if (!/^[0-9A-Za-z]{6,12}$/.test(code)) {
    return NextResponse.json({ error: "国内投信コードを入力してください" }, { status: 400 });
  }

  const url = `https://finance.yahoo.co.jp/quote/${encodeURIComponent(code)}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FinanceApp/1.0)",
      "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Yahoo!ファイナンスから取得できませんでした" }, { status: 502 });
  }

  const html = await response.text();
  const data: FundQuoteResponse = {
    code,
    name: extractName(html),
    price: extractPrice(html),
    date: extractDate(html),
  };

  if (!data.price) {
    return NextResponse.json({ error: "基準価額を読み取れませんでした" }, { status: 502 });
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
