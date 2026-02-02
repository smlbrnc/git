/**
 * BTC 15m arbitraj botu için cüzdan ve API konfigürasyon kontrolü.
 * Çalıştırma: npx tsx src/checkConfig.ts
 */

import { Wallet } from "@ethersproject/wallet";
import { loadSettings } from "./config";
import { getBalance, getClient } from "./trading";
import { getActiveBtc15mSlug, fetchMarketFromSlug } from "./marketLookup";

async function main(): Promise<void> {
  console.log("=".repeat(70));
  console.log("BTC 15M ARB BOT - CONFIGURATION CHECK");
  console.log("=".repeat(70));

  const settings = loadSettings();

  console.log("\n1. Ortam değişkenleri:");
  console.log(`   POLYMARKET_PRIVATE_KEY: ${settings.privateKey ? "✓ Set" : "✗ Missing"}`);
  console.log(`   POLYMARKET_SIGNATURE_TYPE: ${settings.signatureType}`);
  console.log(`   POLYMARKET_FUNDER: ${settings.funder || "(empty)"}`);
  console.log(`   POLYMARKET_API_KEY: ${settings.apiKey ? "✓ Set" : "✗ Missing"}`);
  console.log();

  if (!settings.privateKey?.trim()) {
    console.error("POLYMARKET_PRIVATE_KEY gerekli.");
    process.exit(1);
  }

  try {
    const signer = new Wallet(settings.privateKey.trim());
    const signerAddress = await signer.getAddress();
    console.log("2. Adresler:");
    console.log(`   Signer (private key): ${signerAddress}`);
    console.log(`   Funder (POLYMARKET_FUNDER): ${settings.funder || "(signer ile aynı)"}`);
    console.log();

    if (settings.signatureType === 1) {
      console.log("3. Magic.link (signature_type=1) kontrolü:");
      if (!settings.funder?.trim()) {
        console.log("   ⚠ POLYMARKET_FUNDER boş! Magic.link için Polymarket proxy cüzdan adresini ayarlayın.");
      } else if (settings.funder.toLowerCase() === signerAddress.toLowerCase()) {
        console.log("   ⚠ POLYMARKET_FUNDER signer ile aynı! Magic.link için PROXY cüzdan adresi olmalı.");
      } else {
        console.log("   ✓ POLYMARKET_FUNDER farklı adres (uygun)");
      }
      console.log();
    }

    console.log("4. Polymarket API USDC bakiye:");
    const balance = await getBalance(settings);
    console.log(`   💰 Bakiye: $${balance.toFixed(6)}`);
    console.log();

    console.log("5. neg_risk testi (örnek BTC 15m token):");
    try {
      const slug = await getActiveBtc15mSlug();
      const info = await fetchMarketFromSlug(slug);
      const client = await getClient(settings);
      const negRisk = await client.getNegRisk(info.yesTokenId);
      console.log(`   Token: ${info.yesTokenId.slice(0, 20)}...`);
      console.log(`   neg_risk: ${negRisk}`);
      if (negRisk) console.log("   ✓ BTC 15m neg_risk=true (beklenen)");
      else console.log("   ⚠ neg_risk=false (BTC 15m için beklenmez)");
    } catch (e) {
      console.log("   neg_risk testi atlandı:", String(e));
    }
    console.log();

    console.log("=".repeat(70));
    console.log("CONFIGURATION CHECK TAMAMLANDI");
    console.log("=".repeat(70));
  } catch (e) {
    console.error("Hata:", e);
    process.exit(1);
  }
}

main();
