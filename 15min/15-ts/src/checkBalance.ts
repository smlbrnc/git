/**
 * Polymarket USDC bakiye ve cüzdan kontrolü.
 * Çalıştırma: npx tsx src/checkBalance.ts
 */

import { Wallet } from "@ethersproject/wallet";
import { loadSettings } from "./config";
import { getBalance } from "./trading";

async function main(): Promise<void> {
  const settings = loadSettings();
  const host = "https://clob.polymarket.com";

  console.log("=".repeat(70));
  console.log("BTC 15M ARB BOT - BALANCE CHECK");
  console.log("=".repeat(70));
  console.log(`Host: ${host}`);
  console.log(`Private Key: ${settings.privateKey ? "✓" : "✗"}`);
  console.log(`API Key: ${settings.apiKey ? "✓" : "✗"}`);
  console.log("=".repeat(70));

  if (!settings.privateKey?.trim()) {
    console.error("POLYMARKET_PRIVATE_KEY gerekli.");
    process.exit(1);
  }

  try {
    const signer = new Wallet(settings.privateKey.trim());
    const address = await signer.getAddress();

    console.log("\nAdres:", address);
    const balance = await getBalance(settings);
    console.log("💰 USDC Bakiye: $", balance.toFixed(6));
    console.log("=".repeat(70));
  } catch (e) {
    console.error("Hata:", e);
    process.exit(1);
  }
}

main();
