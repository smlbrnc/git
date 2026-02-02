/**
 * Polymarket'te tek bir test alımı yapar (küçük limit emir, sonra iptal).
 * Çalıştırma: npm run test-order
 */

import { loadSettings } from "./config";
import { getActiveBtc15mSlug, fetchMarketFromSlug } from "./marketLookup";
import { placeOrder, extractOrderId, cancelOrders } from "./trading";

async function main(): Promise<void> {
  const settings = loadSettings();
  if (!settings.privateKey?.trim()) {
    console.error("POLYMARKET_PRIVATE_KEY gerekli.");
    process.exit(1);
  }

  console.log("Aktif BTC 15m piyasası bulunuyor...");
  let slug: string;
  try {
    slug = await getActiveBtc15mSlug();
  } catch {
    if (settings.marketSlug?.trim()) {
      slug = settings.marketSlug.trim();
    } else {
      console.error("Piyasa bulunamadı. POLYMARKET_MARKET_SLUG ayarlayın veya piyasa açık olsun.");
      process.exit(1);
    }
  }

  const info = await fetchMarketFromSlug(slug);
  console.log("Piyasa:", slug);
  console.log("UP (Yes) token:", info.yesTokenId.slice(0, 20) + "...");

  // 1 pay, 0.01$ limit alım (kitaba yazılır, hemen dolmaz)
  const price = 0.01;
  const size = 1;

  console.log("\nTest emri gönderiliyor: BUY", size, "pay @", price, "$ (GTC)...");
  try {
    const result = await placeOrder(settings, {
      side: "BUY",
      tokenId: info.yesTokenId,
      price,
      size,
      tif: "GTC",
    });

    const errMsg = (result as Record<string, unknown>).errorMsg as string | undefined;
    const orderID = extractOrderId(result);

    if (errMsg && String(errMsg).toLowerCase().includes("invalid signature")) {
      console.error("\n>>> INVALID SIGNATURE");
      console.error("    Maker (proxy) ve signer doğru gidiyor; imza sunucuda reddediliyor.");
      console.error("    Deneyin: .env içinde POLYMARKET_SIGNATURE_TYPE=2 (Gnosis Safe / tarayıcı cüzdan).");
      console.error("    E-posta (Magic) = 1, MetaMask/tarayıcı cüzdan = 2. Sonra: npm run test-order");
      console.error("    Hâlâ olursa: private key bu hesaba ait mi? Polymarket Discord / destek.");
      process.exit(1);
    }

    if (orderID) {
      console.log("Emir kabul edildi. Order ID:", orderID);
      console.log("Emir iptal ediliyor (test emri temizliği)...");
      await cancelOrders(settings, [orderID]);
      console.log("İptal gönderildi.");
    } else {
      console.log("API yanıtı:", JSON.stringify(result, null, 2));
      if (errMsg) console.error("Hata mesajı:", errMsg);
    }
  } catch (e) {
    console.error("Emir hatası:", e);
    process.exit(1);
  }
}

main();
