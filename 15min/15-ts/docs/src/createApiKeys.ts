/**
 * Private key ile Polymarket API anahtarları oluşturur.
 * Çalıştırma: npx tsx src/createApiKeys.ts
 * Çıktıyı .env dosyasına ekleyin.
 */

import { Wallet } from "@ethersproject/wallet";
import { ClobClient } from "@polymarket/clob-client";
import { loadSettings } from "./config";

const HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137;

async function main(): Promise<void> {
  const settings = loadSettings();
  const key = settings.privateKey?.trim();

  if (!key) {
    console.error("POLYMARKET_PRIVATE_KEY .env veya ortamda ayarlanmalı.");
    process.exit(1);
  }

  const signer = new Wallet(key);
  const signatureType = settings.signatureType === 0 || settings.signatureType === 1 || settings.signatureType === 2
    ? settings.signatureType
    : 1;
  const funderAddress = settings.funder?.trim() || undefined;

  const client = new ClobClient(HOST, CHAIN_ID, signer, undefined, signatureType, funderAddress);
  const creds = await client.createOrDeriveApiKey();

  console.log("API Key:", creds.key);
  console.log("Secret:", creds.secret);
  console.log("Passphrase:", creds.passphrase);
  console.log();
  console.log(".env dosyanıza ekleyin:");
  console.log("  POLYMARKET_API_KEY=" + creds.key);
  console.log("  POLYMARKET_API_SECRET=" + creds.secret);
  console.log("  POLYMARKET_API_PASSPHRASE=" + creds.passphrase);
}

main().catch((e) => {
  console.error("API anahtarı oluşturma hatası:", e);
  process.exit(1);
});
