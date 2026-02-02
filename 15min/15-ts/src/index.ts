/**
 * BTC 15-minute Polymarket arbitrage bot - ana giriş.
 * Çalıştırma: npm start veya npx tsx src/index.ts
 * UI: http://localhost:3000
 */

import { loadSettings } from "./config";
import { Btc15mArbBot } from "./btc15mArbBot";
import { BotWebServer } from "./server";

async function main(): Promise<void> {
  const settings = loadSettings();
  if (!settings.privateKey?.trim()) {
    console.error("POLYMARKET_PRIVATE_KEY not configured in .env");
    process.exit(1);
  }

  const port = parseInt(process.env.PORT ?? "3000", 10) || 3000;
  const webServer = new BotWebServer(port);
  const bot = await Btc15mArbBot.create(settings);
  webServer.attachBot(bot);

  console.log(`Bot hazır. İşlemi başlatmak için: http://localhost:${port} adresinde Başlat butonuna tıklayın.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
