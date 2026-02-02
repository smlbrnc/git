import axios from "axios";

const BTC_15M_WINDOW = 900;
const SLUG_PATTERN = /^btc-updown-15m-(\d+)$/;

export interface MarketInfo {
  marketId: string;
  yesTokenId: string;
  noTokenId: string;
  outcomes?: string[];
  question?: string;
  startDate?: string;
  endDate?: string;
}

export async function fetchMarketFromSlug(slug: string): Promise<MarketInfo> {
  const cleanSlug = slug.split("?")[0];
  const url = `https://polymarket.com/event/${cleanSlug}`;
  const resp = await axios.get<string>(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 10000,
  });

  const match = resp.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("__NEXT_DATA__ payload not found on page");
  }

  const payload = JSON.parse(match[1]) as Record<string, unknown>;
  const queries = (payload?.props as Record<string, unknown>)?.["pageProps"] as Record<string, unknown> | undefined;
  const dehydrated = queries?.dehydratedState as Record<string, unknown> | undefined;
  const queriesList = (dehydrated?.queries as unknown[]) ?? [];

  let market: Record<string, unknown> | null = null;
  for (const q of queriesList) {
    const state = (q as Record<string, unknown>)?.state as Record<string, unknown> | undefined;
    const data = state?.data as Record<string, unknown> | undefined;
    if (data && Array.isArray(data.markets)) {
      for (const mk of data.markets as Record<string, unknown>[]) {
        if (mk.slug === cleanSlug) {
          market = mk;
          break;
        }
      }
    }
    if (market) break;
  }

  if (!market) {
    throw new Error("Market slug not found in dehydrated state");
  }

  const clobTokenIds = (market.clobTokenIds as string[]) ?? [];
  const outcomes = (market.outcomes as string[]) ?? [];
  if (clobTokenIds.length !== 2 || outcomes.length !== 2) {
    throw new Error("Expected binary market with two clob tokens");
  }

  return {
    marketId: (market.id as string) ?? "",
    yesTokenId: clobTokenIds[0],
    noTokenId: clobTokenIds[1],
    outcomes,
    question: market.question as string | undefined,
    startDate: market.startDate as string | undefined,
    endDate: market.endDate as string | undefined,
  };
}

export function nextSlug(slug: string): string {
  const m = slug.match(/^(.+-)(\d+)$/);
  if (!m) {
    throw new Error(`Slug not in expected format: ${slug}`);
  }
  const [, prefix, num] = m;
  return `${prefix}${parseInt(num, 10) + 900}`;
}

export function parseIso(dt: string | undefined | null): Date | null {
  if (!dt) return null;
  try {
    const normalized = dt.replace("Z", "+00:00");
    return new Date(normalized);
  } catch {
    return null;
  }
}

async function findViaComputedSlugs(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < 7; i++) {
    const ts = now + i * BTC_15M_WINDOW;
    const tsRounded = Math.floor(ts / BTC_15M_WINDOW) * BTC_15M_WINDOW;
    const slug = `btc-updown-15m-${tsRounded}`;
    try {
      await fetchMarketFromSlug(slug);
      if (now < tsRounded + BTC_15M_WINDOW) return slug;
    } catch {
      /* continue */
    }
  }
  return null;
}

async function findViaGammaApi(): Promise<string | null> {
  try {
    const { data } = await axios.get<Array<{ slug?: string }>>(
      "https://gamma-api.polymarket.com/markets",
      { params: { closed: "false", limit: 500 }, headers: { "User-Agent": "Mozilla/5.0" }, timeout: 15000 }
    );
    if (!Array.isArray(data)) return null;
    const now = Math.floor(Date.now() / 1000);
    const candidates: [number, string][] = [];
    for (const m of data) {
      const slug = (m.slug ?? "").trim();
      const match = slug.match(SLUG_PATTERN);
      if (!match) continue;
      const ts = parseInt(match[1], 10);
      if (now < ts + BTC_15M_WINDOW) candidates.push([ts, slug]);
    }
    if (candidates.length === 0) {
      for (const m of data) {
        const slug = (m.slug ?? "").trim();
        const match = slug.match(SLUG_PATTERN);
        if (match) candidates.push([parseInt(match[1], 10), slug]);
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (b[0] + BTC_15M_WINDOW > now ? 1 : 0) - (a[0] + BTC_15M_WINDOW > now ? 1 : 0) || b[0] - a[0]);
    return candidates[0][1];
  } catch {
    return null;
  }
}

async function findViaPageScrape(): Promise<string | null> {
  try {
    const { data: html } = await axios.get<string>("https://polymarket.com/crypto/15M", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 15000,
    });
    const now = Math.floor(Date.now() / 1000);
    const matches = [...html.matchAll(/btc-updown-15m-(\d+)/g)];
    if (matches.length > 0) {
      const allTs = [...new Set(matches.map((m) => parseInt(m[1], 10)))].sort((a, b) => b - a);
      const openTs = allTs.filter((t) => now < t + BTC_15M_WINDOW);
      const chosen = openTs[0] ?? allTs[0];
      return `btc-updown-15m-${chosen}`;
    }
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      const payload = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
      const findSlugs = (obj: unknown): string[] => {
        if (obj && typeof obj === "object" && "slug" in obj) {
          const s = (obj as { slug: unknown }).slug;
          if (typeof s === "string" && SLUG_PATTERN.test(s)) return [s];
        }
        if (Array.isArray(obj)) return obj.flatMap(findSlugs);
        if (obj && typeof obj === "object") return Object.values(obj).flatMap(findSlugs);
        return [];
      };
      const slugs = findSlugs(payload);
      if (slugs.length > 0) return slugs[0];
    }
    return null;
  } catch {
    return null;
  }
}

export async function getActiveBtc15mSlug(): Promise<string> {
  const slug = await findViaComputedSlugs();
  if (slug) return slug;
  const gamma = await findViaGammaApi();
  if (gamma) return gamma;
  const scrape = await findViaPageScrape();
  if (scrape) return scrape;
  throw new Error(
    "No active BTC 15min market found (tried computed slugs, Gamma API, and crypto/15M page). Set POLYMARKET_MARKET_SLUG in .env to a slug like btc-updown-15m-<timestamp>."
  );
}
