import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FundQuoteResult = {
  code: string;
  name: string | null;
  price: number;
  quoteDate: string | null;
  source: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function htmlToLines(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<[^>]+>/g, "\n"),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parsePriceText(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^\d{2,}$/.test(normalized)) return null;
  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function extractQuoteFromYahooJapan(html: string, code: string): FundQuoteResult | null {
  const lines = htmlToLines(html);
  const codeIndex = lines.findIndex((line) => line === code);
  if (codeIndex < 0) return null;

  const name = [...lines.slice(Math.max(0, codeIndex - 8), codeIndex)]
    .reverse()
    .find((line) => line && !line.includes("Yahoo") && !line.includes("投資信託") && !/^#+$/.test(line)) ?? null;

  const priceLine = lines
    .slice(codeIndex + 1, codeIndex + 30)
    .find((line) => parsePriceText(line) !== null);
  const price = priceLine ? parsePriceText(priceLine) : null;
  if (!price) return null;

  const quoteDate = lines
    .slice(codeIndex + 1, codeIndex + 40)
    .find((line) => /^\d{1,2}\/\d{1,2}$/.test(line)) ?? null;

  return {
    code,
    name,
    price,
    quoteDate,
    source: "Yahoo!ファイナンス日本版",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "").trim().replace(/\s+/g, "");

  if (!/^[0-9A-Za-z]{6,12}$/.test(code)) {
    return NextResponse.json({ error: "国内投信コードを入力してください" }, { status: 400 });
  }

  const url = `https://finance.yahoo.co.jp/quote/${encodeURIComponent(code)}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; finance-app/1.0; +https://finance.yahoo.co.jp)",
        "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Yahoo!ファイナンス日本版から取得できませんでした" }, { status: 502 });
    }

    const html = await response.text();
    const quote = extractQuoteFromYahooJapan(html, code);
    if (!quote) {
      return NextResponse.json({ error: "基準価額を読み取れませんでした" }, { status: 404 });
    }

    return NextResponse.json(quote);
  } catch {
    return NextResponse.json({ error: "基準価額取得中に通信エラーが発生しました" }, { status: 500 });
  }
}
