/**
 * Python py_clob_client örneğinin TypeScript karşılığı.
 * .env: POLYMARKET_PRIVATE_KEY, TEST_ORDER_TOKEN_ID (ve isteğe bağlı TEST_ORDER_PRICE, SIZE, SIDE)
 * Çalıştırma: npm run simple-order
 */

import { loadSettings } from "./config";
import { getClient, placeOrder, extractOrderId } from "./trading";

async function main(): Promise<void> {
  if (!process.env.POLYMARKET_PRIVATE_KEY?.trim()) {
    console.error("POLYMARKET_PRIVATE_KEY ortam değişkeni gerekli.");
    process.exit(1);
  }

  const tokenId = process.env.TEST_ORDER_TOKEN_ID?.trim() || process.env.POLYMARKET_YES_TOKEN_ID?.trim();
  if (!tokenId) {
    console.error("TEST_ORDER_TOKEN_ID veya POLYMARKET_YES_TOKEN_ID gerekli.");
    process.exit(1);
  }

  const price = parseFloat(process.env.TEST_ORDER_PRICE ?? "0.65") || 0.65;
  const size = parseFloat(process.env.TEST_ORDER_SIZE ?? "10") || 10;
  const side = (process.env.TEST_ORDER_SIDE ?? "BUY").toUpperCase();

  const settings = loadSettings();
  try {
    console.log("İstemci başlatılıyor...");
    await getClient(settings);
    console.log("API kimlik doğrulaması başarılı.");
    console.log(`${side} emri gönderiliyor: ${size} adet @ ${price} fiyatından...`);
    const resp = await placeOrder(settings, { side, tokenId, price, size, tif: "GTC" });
    const orderId = extractOrderId(resp);
    const errMsg = (resp as Record<string, unknown>).errorMsg as string | undefined;
    if (orderId) {
      console.log("✅ İşlem başarılı!");
      console.log("Order ID:", orderId);
    } else {
      console.log("❌ Beklenen yanıt gelmedi.");
      if (errMsg) console.error(errMsg);
      console.log(resp);
    }
  } catch (e) {
    console.error("Hata:", e);
    process.exit(1);
  }
}

main();
