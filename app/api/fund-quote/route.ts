import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type QuoteKind = "fund" | "market";

type QuoteResult = {
  code: string;
  name: string | null;
  price: number;
  quoteDate: string | null;
  source: string;
  kind: QuoteKind;
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
  if (/^\d{1,2}\/\d{1,2}$/.test(normalized)) return null;
  if (/^\d{1,2}:\d{2}$/.test(normalized)) return null;
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function isLikelyCodeLine(line: string, code: string) {
  const upperLine = line.toUpperCase();
  const upperCode = code.toUpperCase();
  return upperLine === upperCode || upperLine.startsWith(`${upperCode} `) || upperLine.startsWith(`${upperCode}　`);
}

function extractName(lines: string[], codeIndex: number) {
  return [...lines.slice(Math.max(0, codeIndex - 10), codeIndex)]
    .reverse()
    .find(
      (line) =>
        line &&
        !line.includes("Yahoo") &&
        !line.includes("投資信託") &&
        !line.includes("米国株") &&
        !line.includes("日本株") &&
        !line.includes("トップ") &&
        !/^#+$/.test(line),
    ) ?? null;
}

function extractQuoteFromYahooJapan(html: string, code: string, kind: QuoteKind): QuoteResult | null {
  const lines = htmlToLines(html);
  const codeIndex = lines.findIndex((line) => isLikelyCodeLine(line, code));
  if (codeIndex < 0) return null;

  const priceLine = lines
    .slice(codeIndex + 1, codeIndex + 35)
    .find((line) => parsePriceText(line) !== null);
  const price = priceLine ? parsePriceText(priceLine) : null;
  if (!price) return null;

  const quoteDate = lines
    .slice(codeIndex + 1, codeIndex + 45)
    .find((line) => /^\d{1,2}\/\d{1,2}$/.test(line) || /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(line)) ?? null;

  return {
    code,
    name: extractName(lines, codeIndex),
    price,
    quoteDate,
    source: "Yahoo!ファイナンス日本版",
    kind,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "").trim().replace(/\s+/g, "");
  const kind: QuoteKind = searchParams.get("type") === "market" ? "market" : "fund";

  if (!/^[0-9A-Za-z.=_-]{1,20}$/.test(code)) {
    return NextResponse.json({ error: "取得コードを入力してください" }, { status: 400 });
  }

  const candidates = Array.from(
    new Set(
      kind === "market"
        ? [code, code.toUpperCase()]
        : [code],
    ),
  );

  try {
    for (const candidate of candidates) {
      const url = `https://finance.yahoo.co.jp/quote/${encodeURIComponent(candidate)}`;
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; finance-app/1.0; +https://finance.yahoo.co.jp)",
          "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
        },
      });

      if (!response.ok) continue;

      const html = await response.text();
      const quote = extractQuoteFromYahooJapan(html, candidate, kind);
      if (quote) return NextResponse.json(quote);
    }

    return NextResponse.json({ error: "価格を読み取れませんでした" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "価格取得中に通信エラーが発生しました" }, { status: 500 });
  }
}
