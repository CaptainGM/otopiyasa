import * as cheerio from "cheerio";
import { fetchPageHtml, fetchPageHtmlWithBrowser } from "@/lib/scraper/browser-scrape";

export interface LiveMarketResult {
  brand: string;
  model: string;
  avg: number;
  min: number;
  max: number;
  count: number;
  source: string;
}

function extractPricesFromSearch(html: string): number[] {
  const $ = cheerio.load(html);
  const prices: number[] = [];

  $("span.listing-price").each((_, el) => {
    const digits = $(el).text().replace(/[^\d]/g, "");
    if (digits) prices.push(Number(digits));
  });


  return prices.filter((p) => p > 50000 && p < 100_000_000);
}


export async function fetchArabamMarketAverage(
  brand: string,
  model: string
): Promise<LiveMarketResult | null> {
  const query = `${brand} ${model}`.trim();
  const url = `https://www.arabam.com/ikinci-el/otomobil?searchText=${encodeURIComponent(query)}`;

  let html = "";
  try {
    const direct = await fetchPageHtml(url);
    html = direct.ok ? direct.html : await fetchPageHtmlWithBrowser(url);
  } catch {
    return null;
  }

  let prices = extractPricesFromSearch(html);
  if (prices.length === 0) {
    try {
      html = await fetchPageHtmlWithBrowser(url);
      prices = extractPricesFromSearch(html);
    } catch {
      return null;
    }
  }

  if (prices.length < 3) return null;

  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    brand,
    model,
    avg: Math.round(sum / prices.length),
    min: Math.min(...prices),
    max: Math.max(...prices),
    count: prices.length,
    source: "arabam.com (canlı arama)",
  };
}
