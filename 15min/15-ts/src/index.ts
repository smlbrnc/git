/**
 * BTC 15-minute Polymarket arbitrage bot - ana giriş.
 * Çalıştırma: npm start veya npx tsx src/index.ts
 */

import { main } from "./btc15mArbBot";

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
