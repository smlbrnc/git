/**
 * Polymarket piyasasından Yes/No token ID'lerini alır.
 * .env'de POLYMARKET_MARKET_SLUG yoksa aktif BTC 15m piyasası kullanılır.
 * Çıktıyı .env içinde TEST_ORDER_TOKEN_ID=... olarak kopyalayabilirsin.
 * Çalıştırma: npm run get-token-id
 */

import { loadSettings } from "./config";
import { getActiveBtc15mSlug, fetchMarketFromSlug } from "./marketLookup";

async function main(): Promise<void> {
  const settings = loadSettings();
  let slug: string;
  try {
    slug = settings.marketSlug?.trim() || (await getActiveBtc15mSlug());
  } catch (e) {
    console.error("Piyasa bulunamadı. .env'de POLYMARKET_MARKET_SLUG ayarlayın (örn: btc-updown-15m-1738512000).");
    console.error(e);
    process.exit(1);
  }

  const info = await fetchMarketFromSlug(slug);
  console.log("Slug:", slug);
  console.log("");
  console.log("TEST_ORDER_TOKEN_ID (Yes) için .env'e yapıştır:");
  console.log("TEST_ORDER_TOKEN_ID=" + info.yesTokenId);
  console.log("");
  console.log("No token (isteğe bağlı):");
  console.log(info.noTokenId);
}

main();
