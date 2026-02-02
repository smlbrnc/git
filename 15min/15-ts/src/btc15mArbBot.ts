/**
 * BTC 15-minute arbitrage bot for Polymarket.
 * Strategy: Buy both sides (UP and DOWN) when total cost < threshold to lock in profit.
 */

import { EventEmitter } from "events";
import type { Settings } from "./config";
import type { MarketInfo } from "./marketLookup";
import { fetchMarketFromSlug, getActiveBtc15mSlug } from "./marketLookup";
import {
  getBalance,
  getOrderBook as fetchOrderBook,
  placeOrder,
  placeOrdersFast,
  extractOrderId,
  waitForTerminalOrder,
  cancelOrders,
  getPositions,
  type OrderSpec,
} from "./trading";
import { MarketWssClient } from "./wssMarket";

const BTC_15M_WINDOW = 900;

export interface Opportunity {
  price_up: number;
  price_down: number;
  total_cost: number;
  profit_per_share: number;
  profit_pct: number;
  order_size: number;
  total_investment: number;
  expected_payout: number;
  expected_profit: number;
  best_ask_up?: number;
  best_ask_down?: number;
  vwap_up?: number;
  vwap_down?: number;
  timestamp: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class Btc15mArbBot extends EventEmitter {
  settings: Settings;
  marketSlug: string;
  marketId: string;
  yesTokenId: string;
  noTokenId: string;
  marketEndTimestamp: number | null;
  opportunitiesFound = 0;
  tradesExecuted = 0;
  totalInvested = 0;
  totalSharesBought = 0;
  positions: Opportunity[] = [];
  cachedBalance: number | null = null;
  simBalance: number;
  simStartBalance: number;
  private _lastExecutionTs = 0;
  private _stopRequested = false;

  stop(): void {
    this._stopRequested = true;
  }

  constructor(settings: Settings, slug: string, info: MarketInfo) {
    super();
    this.settings = settings;
    this.marketSlug = slug;
    this.marketId = info.marketId;
    this.yesTokenId = info.yesTokenId;
    this.noTokenId = info.noTokenId;

    const match = slug.match(/btc-updown-15m-(\d+)/);
    const marketStart = match ? parseInt(match[1], 10) : null;
    this.marketEndTimestamp = marketStart != null ? marketStart + BTC_15M_WINDOW : null;

    this.simBalance = this.settings.simBalance > 0 ? this.settings.simBalance : 100;
    this.simStartBalance = this.simBalance;
  }

  static async create(settings: Settings): Promise<Btc15mArbBot> {
    let slug: string;
    try {
      slug = await getActiveBtc15mSlug();
    } catch {
      if (settings.marketSlug?.trim()) slug = settings.marketSlug.trim();
      else throw new Error("Could not find BTC 15min market and no POLYMARKET_MARKET_SLUG in .env");
    }
    const info = await fetchMarketFromSlug(slug);
    return new Btc15mArbBot(settings, slug, info);
  }

  getTimeRemaining(): string {
    if (this.marketEndTimestamp == null) return "Unknown";
    const now = Math.floor(Date.now() / 1000);
    const remaining = this.marketEndTimestamp - now;
    if (remaining <= 0) return "CLOSED";
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    return `${minutes}m ${seconds}s`;
  }

  async getBalance(): Promise<number> {
    if (this.settings.dryRun) return this.simBalance;
    return getBalance(this.settings);
  }

  async getOrderBook(tokenId: string): Promise<Record<string, unknown>> {
    try {
      const book = await fetchOrderBook(this.settings, tokenId);
      return {
        best_bid: book.best_bid,
        best_ask: book.best_ask,
        spread: book.spread,
        bid_size: book.bid_size,
        ask_size: book.ask_size,
        bids: book.bids,
        asks: book.asks,
      };
    } catch (e) {
      console.error("Error getting order book:", e);
      return {};
    }
  }

  private _computeBuyFill(
    asks: [number, number][],
    targetSize: number
  ): { filled: number; vwap: number; worst: number; best: number; cost: number } | null {
    if (targetSize <= 0) return null;
    const sorted = [...asks].sort((a, b) => a[0] - b[0]);
    let filled = 0;
    let cost = 0;
    let worst: number | null = null;
    const best = sorted[0]?.[0] ?? null;
    for (const [price, size] of sorted) {
      if (filled >= targetSize) break;
      const take = Math.min(size, targetSize - filled);
      cost += take * price;
      filled += take;
      worst = price;
    }
    if (filled + 1e-9 < targetSize) return null;
    return {
      filled,
      vwap: cost / filled,
      worst: worst!,
      best: best!,
      cost,
    };
  }

  private _bookFromState(
    bidLevels: [number, number][],
    askLevels: [number, number][]
  ): Record<string, unknown> {
    const bestBid = bidLevels.length ? Math.max(...bidLevels.map(([p]) => p)) : null;
    const bestAsk = askLevels.length ? Math.min(...askLevels.map(([p]) => p)) : null;
    let bidSize = 0;
    let askSize = 0;
    if (bestBid != null) {
      const l = bidLevels.find(([p]) => p === bestBid);
      if (l) bidSize = l[1];
    }
    if (bestAsk != null) {
      const l = askLevels.find(([p]) => p === bestAsk);
      if (l) askSize = l[1];
    }
    const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
    return {
      best_bid: bestBid,
      best_ask: bestAsk,
      spread,
      bid_size: bidSize,
      ask_size: askSize,
      bids: bidLevels,
      asks: askLevels,
    };
  }

  checkArbitrage(
    upBook?: Record<string, unknown>,
    downBook?: Record<string, unknown>
  ): Opportunity | null {
    if (upBook == null || downBook == null) return null;

    const bestBidUp = upBook.best_bid as number | null | undefined;
    const bestAskUp = upBook.best_ask as number | null | undefined;
    const bestBidDown = downBook.best_bid as number | null | undefined;
    const bestAskDown = downBook.best_ask as number | null | undefined;

    if (bestBidUp != null && bestAskUp != null && bestAskUp < bestBidUp) return null;
    if (bestBidDown != null && bestAskDown != null && bestAskDown < bestBidDown) return null;

    const asksUp = (upBook.asks as [number, number][]) ?? [];
    const asksDown = (downBook.asks as [number, number][]) ?? [];
    const orderSize = Number(this.settings.orderSize);
    const fillUp = this._computeBuyFill(asksUp, orderSize);
    const fillDown = this._computeBuyFill(asksDown, orderSize);
    if (!fillUp || !fillDown) return null;

    const limitPriceUp = fillUp.worst;
    const limitPriceDown = fillDown.worst;
    const totalCost = limitPriceUp + limitPriceDown;

    if (totalCost > this.settings.targetPairCost) return null;

    const profit = 1 - totalCost;
    const profitPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const investment = totalCost * orderSize;
    const expectedPayout = 1 * orderSize;
    const expectedProfit = expectedPayout - investment;

    const opportunity: Opportunity = {
      price_up: limitPriceUp,
      price_down: limitPriceDown,
      total_cost: totalCost,
      profit_per_share: profit,
      profit_pct: profitPct,
      order_size: orderSize,
      total_investment: investment,
      expected_payout: expectedPayout,
      expected_profit: expectedProfit,
      best_ask_up: fillUp.best,
      best_ask_down: fillDown.best,
      vwap_up: fillUp.vwap,
      vwap_down: fillDown.vwap,
      timestamp: new Date().toISOString(),
    };
    this.emit("opportunity_found", opportunity);
    return opportunity;
  }

  async executeArbitrage(opportunity: Opportunity): Promise<void> {
    const now = Date.now() / 1000;
    if (this.settings.cooldownSeconds && now - this._lastExecutionTs < this.settings.cooldownSeconds) {
      return;
    }
    this._lastExecutionTs = now;
    this.opportunitiesFound += 1;

    console.log("=".repeat(70));
    console.log("ARBITRAGE OPPORTUNITY DETECTED");
    console.log("=".repeat(70));
    console.log(`UP limit price:       $${opportunity.price_up.toFixed(4)}`);
    console.log(`DOWN limit price:     $${opportunity.price_down.toFixed(4)}`);
    if (opportunity.vwap_up != null && opportunity.vwap_down != null) {
      console.log(`UP VWAP (est):        $${opportunity.vwap_up.toFixed(4)}`);
      console.log(`DOWN VWAP (est):      $${opportunity.vwap_down.toFixed(4)}`);
    }
    console.log(`Total cost:           $${opportunity.total_cost.toFixed(4)}`);
    console.log(`Profit per share:     $${opportunity.profit_per_share.toFixed(4)}`);
    console.log(`Profit %:             ${opportunity.profit_pct.toFixed(2)}%`);
    console.log("-".repeat(70));
    console.log(`Order size:           ${opportunity.order_size} shares each side`);
    console.log(`Total investment:     $${opportunity.total_investment.toFixed(2)}`);
    console.log(`Expected payout:      $${opportunity.expected_payout.toFixed(2)}`);
    console.log(`EXPECTED PROFIT:      $${opportunity.expected_profit.toFixed(2)}`);
    console.log("=".repeat(70));

    if (this.settings.dryRun) {
      if (this.simBalance < opportunity.total_investment) {
        console.error(`Insufficient simulated balance: need $${opportunity.total_investment.toFixed(2)} but have $${this.simBalance.toFixed(2)}`);
        this.emit("trade_failed", { opportunity, error: "Insufficient simulated balance" });
        return;
      }
      this.simBalance -= opportunity.total_investment;
      this.totalInvested += opportunity.total_investment;
      this.totalSharesBought += opportunity.order_size * 2;
      this.positions.push(opportunity);
      this.tradesExecuted += 1;
      this.emit("trade_executed", {
        opportunity,
        orderIds: ["dry-run-up", "dry-run-down"],
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const minSizeForValue = Math.ceil(1 / Math.min(opportunity.price_up, opportunity.price_down));
    const size = Math.max(Number(opportunity.order_size), minSizeForValue);
    const actualInvestment = opportunity.total_cost * size;
    let currentBalance = this.cachedBalance ?? (await this.getBalance());
    this.cachedBalance = currentBalance;
    const required = actualInvestment * 1.2;
    if (currentBalance < required) {
      console.error(`Insufficient balance: need $${required.toFixed(2)} but have $${currentBalance.toFixed(2)}`);
      this.emit("trade_failed", { opportunity, error: "Insufficient balance" });
      return;
    }

    // Polymarket: emir tutarı en az $1 olmalı (min size: $1)
    const orders: OrderSpec[] = [
      { side: "BUY", token_id: this.yesTokenId, price: opportunity.price_up, size },
      { side: "BUY", token_id: this.noTokenId, price: opportunity.price_down, size },
    ];
    const orderType = this.settings.orderType || "GTC";
    const results = await placeOrdersFast(this.settings, orders, orderType);

    const orderIds: (string | null)[] = [];
    let hasInvalidSignature = false;
    for (let i = 0; i < Math.min(2, results.length); i++) {
      const r = results[i];
      if (r && typeof r === "object" && "error" in r) {
        console.error(`Sipariş ${i + 1} hata:`, (r as Record<string, unknown>).error);
        orderIds.push(null);
        continue;
      }
      const errMsg = r && typeof r === "object" ? (r as Record<string, unknown>).errorMsg as string : "";
      if (errMsg && String(errMsg).toLowerCase().includes("invalid signature")) {
        hasInvalidSignature = true;
      }
      const oid = extractOrderId(r);
      if (!oid && r && typeof r === "object") {
        console.warn(`Sipariş ${i + 1} order ID çıkarılamadı, API yanıtı:`, JSON.stringify(r).slice(0, 300));
      }
      orderIds.push(oid);
    }

    if (hasInvalidSignature) {
      console.error("");
      console.error(">>> INVALID SIGNATURE - Yapmanız gerekenler:");
      console.error("    1. Polymarket'te e-posta ile giriş yapıyorsanız: POLYMARKET_SIGNATURE_TYPE=1");
      console.error("       ve POLYMARKET_FUNDER = profil sayfanızdaki proxy cüzdan adresi (Copy address) olmalı.");
      console.error("    2. POLYMARKET_FUNDER, private key'in türettiği adres DEĞİL; polymarket.com profilindeki adres olmalı.");
      console.error("    3. API anahtarlarını bu ayarlarla YENİDEN oluşturun: npm run create-api-keys");
      console.error("       Sonra .env içindeki POLYMARKET_API_KEY, SECRET, PASSPHRASE değerlerini güncelleyin.");
      console.error("");
      this.emit("trade_failed", { opportunity, error: "Invalid signature" });
      return;
    }

    if (!orderIds[0] && !orderIds[1]) {
      console.error("Her iki emir de reddedildi. API yanıtı:", JSON.stringify(results, null, 2));
      this.emit("trade_failed", { opportunity, error: "Both orders rejected", results });
      return;
    }

    const upState = orderIds[0]
      ? await waitForTerminalOrder(this.settings, orderIds[0], { requestedSize: size })
      : { filled: false as const, filled_size: 0 };
    const downState = orderIds[1]
      ? await waitForTerminalOrder(this.settings, orderIds[1], { requestedSize: size })
      : { filled: false as const, filled_size: 0 };

    const upFilled = !!upState.filled;
    const downFilled = !!downState.filled;

    if (!upFilled || !downFilled) {
      const toCancel = [orderIds[0], orderIds[1]].filter((id): id is string => !!id);
      if (toCancel.length) await cancelOrders(this.settings, toCancel).catch(() => {});
      this.emit("trade_failed", {
        opportunity,
        error: "Partial fill (one side only)",
        orderIds: [orderIds[0], orderIds[1]],
      });
      let filledTokenId: string | null = null;
      let filledSize = 0;
      if (upFilled && !downFilled) {
        filledTokenId = this.yesTokenId;
        filledSize = upState.filled_size ?? size;
      } else if (downFilled && !upFilled) {
        filledTokenId = this.noTokenId;
        filledSize = downState.filled_size ?? size;
      }
      if (filledTokenId && filledSize > 0) {
        try {
          const book = await this.getOrderBook(filledTokenId);
          const bestBid = book.best_bid as number | undefined;
          if (bestBid != null) {
            console.log(`Unwinding ${filledSize} shares of token ${filledTokenId.slice(0, 10)}... at $${bestBid}`);
            try {
              await placeOrder(this.settings, {
                side: "SELL",
                tokenId: filledTokenId,
                price: bestBid,
                size: filledSize,
                tif: "IOC",
              });
              console.log("Unwind successful with IOC");
            } catch (iocErr) {
              console.warn("IOC unwind failed, trying GTC:", iocErr);
              await placeOrder(this.settings, {
                side: "SELL",
                tokenId: filledTokenId,
                price: bestBid,
                size: filledSize,
                tif: "GTC",
              });
              console.log("Unwind placed as GTC order");
            }
          }
        } catch (e) {
          console.error("Unwind attempt failed:", e);
        }
      }
      return;
    }

    this.tradesExecuted += 1;
    this.totalInvested += actualInvestment;
    this.totalSharesBought += size * 2;
    this.positions.push({ ...opportunity, order_size: size, total_investment: actualInvestment });
    this.cachedBalance = await this.getBalance();
    this.emit("trade_executed", {
      opportunity: { ...opportunity, order_size: size, total_investment: actualInvestment },
      orderIds: [orderIds[0]!, orderIds[1]!],
      timestamp: new Date().toISOString(),
    });
    this.showCurrentPositions();
  }

  async showCurrentPositions(): Promise<void> {
    try {
      const positions = await getPositions(this.settings, [this.yesTokenId, this.noTokenId]);
      const upShares = positions[this.yesTokenId]?.size ?? 0;
      const downShares = positions[this.noTokenId]?.size ?? 0;
      console.log("-".repeat(70));
      console.log("CURRENT POSITIONS:");
      console.log(`   UP shares:   ${upShares.toFixed(2)}`);
      console.log(`   DOWN shares: ${downShares.toFixed(2)}`);
      console.log("-".repeat(70));
    } catch (e) {
      console.warn("Could not fetch positions:", e);
    }
  }

  async getMarketResult(): Promise<string | null> {
    try {
      const upBook = await this.getOrderBook(this.yesTokenId);
      const downBook = await this.getOrderBook(this.noTokenId);
      const priceUp = upBook.best_ask as number | undefined;
      const priceDown = downBook.best_ask as number | undefined;
      if (priceUp == null || priceDown == null) return null;
      if (priceUp >= 0.99) return "UP (goes up)";
      if (priceDown >= 0.99) return "DOWN (goes down)";
      if (priceUp > priceDown) return `UP leading (${(priceUp * 100).toFixed(0)}%)`;
      return `DOWN leading (${(priceDown * 100).toFixed(0)}%)`;
    } catch {
      return null;
    }
  }

  async showFinalSummary(): Promise<void> {
    console.log("\n" + "=".repeat(70));
    console.log("MARKET CLOSED - FINAL SUMMARY");
    console.log("=".repeat(70));
    console.log(`Market: ${this.marketSlug}`);
    const result = await this.getMarketResult();
    if (result) console.log(`Result: ${result}`);
    console.log(`Mode: ${this.settings.dryRun ? "SIMULATION" : "REAL TRADING"}`);
    console.log("-".repeat(70));
    console.log(`Total opportunities detected:    ${this.opportunitiesFound}`);
    console.log(`Total trades executed:           ${this.tradesExecuted}`);
    console.log(`Total shares bought:             ${this.totalSharesBought}`);
    console.log("-".repeat(70));
    console.log(`Total invested:                  $${this.totalInvested.toFixed(2)}`);
    const expectedPayout = this.settings.dryRun
      ? this.positions.reduce((s, p) => s + (p.expected_payout ?? 0), 0)
      : (this.totalSharesBought / 2) * 1;
    const expectedProfit = expectedPayout - this.totalInvested;
    const profitPct = this.totalInvested > 0 ? (expectedProfit / this.totalInvested) * 100 : 0;
    console.log(`Expected payout at close:        $${expectedPayout.toFixed(2)}`);
    console.log(`Expected profit:                 $${expectedProfit.toFixed(2)} (${profitPct.toFixed(2)}%)`);
    if (this.settings.dryRun) {
      const cashRemaining = this.simBalance;
      const cashAfterClaim = cashRemaining + expectedPayout;
      const netChange = cashAfterClaim - this.simStartBalance;
      const netPct = this.simStartBalance > 0 ? (netChange / this.simStartBalance) * 100 : 0;
      console.log("-".repeat(70));
      console.log(`Sim start cash:                  $${this.simStartBalance.toFixed(2)}`);
      console.log(`Sim cash remaining:              $${cashRemaining.toFixed(2)}`);
      console.log(`Sim cash after claiming:         $${cashAfterClaim.toFixed(2)}`);
      console.log(`Sim net change:                  $${netChange.toFixed(2)} (${netPct.toFixed(2)}%)`);
    }
    console.log("=".repeat(70));
  }

  async runOnceAsync(): Promise<boolean> {
    if (this.getTimeRemaining() === "CLOSED") return false;

    const upBook = await this.getOrderBook(this.yesTokenId);
    const downBook = await this.getOrderBook(this.noTokenId);
    const opportunity = this.checkArbitrage(upBook as Record<string, unknown>, downBook as Record<string, unknown>);

    if (opportunity) {
      await this.executeArbitrage(opportunity);
      return true;
    }

    const priceUp = upBook.best_ask as number | undefined;
    const priceDown = downBook.best_ask as number | undefined;
    const sizeUp = (upBook.ask_size as number) ?? 0;
    const sizeDown = (downBook.ask_size as number) ?? 0;
    if (priceUp != null && priceDown != null) {
      const bestTotal = priceUp + priceDown;
      const asksUp = (upBook.asks as [number, number][]) ?? [];
      const asksDown = (downBook.asks as [number, number][]) ?? [];
      const fillUp = this._computeBuyFill(asksUp, Number(this.settings.orderSize));
      const fillDown = this._computeBuyFill(asksDown, Number(this.settings.orderSize));
      let fillMsg = "";
      if (fillUp && fillDown && fillUp.worst != null && fillDown.worst != null) {
        const worstTotal = fillUp.worst + fillDown.worst;
        fillMsg = fillUp.vwap != null && fillDown.vwap != null
          ? ` | fill(worst)=$${worstTotal.toFixed(4)} vwap=$${(fillUp.vwap + fillDown.vwap).toFixed(4)}`
          : ` | fill(worst)=$${worstTotal.toFixed(4)}`;
      }
      console.log(
        `No arbitrage: UP=$${priceUp.toFixed(4)} (${sizeUp}) + DOWN=$${priceDown.toFixed(4)} (${sizeDown}) = $${bestTotal.toFixed(4)} (threshold=${this.settings.targetPairCost.toFixed(3)})${fillMsg} [Time: ${this.getTimeRemaining()}]`
      );
    }
    return false;
  }

  async monitor(intervalSeconds: number = 30): Promise<void> {
    this._stopRequested = false;
    if (this.settings.useWss) {
      await this.monitorWss();
      return;
    }

    console.log("=".repeat(70));
    console.log("BITCOIN 15MIN ARBITRAGE BOT STARTED");
    console.log("=".repeat(70));
    console.log(`Market: ${this.marketSlug}`);
    console.log(`Time remaining: ${this.getTimeRemaining()}`);
    console.log(`Mode: ${this.settings.dryRun ? "SIMULATION" : "REAL TRADING"}`);
    console.log(`Cost threshold: $${this.settings.targetPairCost.toFixed(3)}`);
    console.log(`Order size: ${this.settings.orderSize} shares`);
    console.log(`Interval: ${intervalSeconds}s`);
    console.log("=".repeat(70));

    let scanCount = 0;
    try {
      for (;;) {
        if (this._stopRequested) break;
        scanCount += 1;
        console.log(`\n[Scan #${scanCount}] ${new Date().toTimeString().slice(0, 8)}`);

        if (this.getTimeRemaining() === "CLOSED") {
          await this.showFinalSummary();
          try {
            const newSlug = await getActiveBtc15mSlug();
            if (newSlug !== this.marketSlug) {
              const next = await Btc15mArbBot.create(this.settings);
              Object.assign(this, next);
              scanCount = 0;
              continue;
            }
          } catch {
            /* use same slug or retry later */
          }
          await sleep(30000);
          continue;
        }

        await this.runOnceAsync();
        console.log(`Opportunities found: ${this.opportunitiesFound}/${scanCount}`);
        if (!this.settings.dryRun) console.log(`Trades executed: ${this.tradesExecuted}`);
        console.log(`Waiting ${intervalSeconds}s...\n`);
        await sleep(intervalSeconds * 1000);
      }
    } catch (err) {
      if ((err as NodeJS.Signals) !== "SIGINT" && (err as NodeJS.Signals) !== "SIGTERM") throw err;
      console.log("\n" + "=".repeat(70));
      console.log("Bot stopped by user");
      console.log(`Total scans: ${scanCount}`);
      console.log(`Opportunities found: ${this.opportunitiesFound}`);
      if (!this.settings.dryRun) console.log(`Trades executed: ${this.tradesExecuted}`);
      console.log("=".repeat(70));
    }
  }

  async monitorWss(): Promise<void> {
    this._stopRequested = false;
    while (true) {
      if (this._stopRequested) break;
      if (this.getTimeRemaining() === "CLOSED") {
        await this.showFinalSummary();
        try {
          const newSlug = await getActiveBtc15mSlug();
          if (newSlug !== this.marketSlug) {
            const next = await Btc15mArbBot.create(this.settings);
            Object.assign(this, next);
            continue;
          }
        } catch {
          /* */
        }
        await sleep(10000);
        continue;
      }

      console.log("=".repeat(70));
      console.log("BITCOIN 15MIN ARBITRAGE BOT STARTED (WSS MODE)");
      console.log("=".repeat(70));
      console.log(`Market: ${this.marketSlug}`);
      console.log(`Time remaining: ${this.getTimeRemaining()}`);
      console.log(`Mode: ${this.settings.dryRun ? "SIMULATION" : "REAL TRADING"}`);
      console.log(`Cost threshold: $${this.settings.targetPairCost.toFixed(3)}`);
      console.log(`Order size: ${this.settings.orderSize} shares`);
      console.log(`WSS URL: ${this.settings.wsUrl}`);
      console.log("=".repeat(70));

      const client = new MarketWssClient({
        wsBaseUrl: this.settings.wsUrl,
        assetIds: [this.yesTokenId, this.noTokenId],
      });

      let lastEval = 0;
      const evalMinIntervalS = 0.05;
      let evalCount = 0;

      try {
        for await (const [_assetId, _eventType] of client.run()) {
          if (this._stopRequested) break;
          if (this.getTimeRemaining() === "CLOSED") {
            await this.showFinalSummary();
            try {
              const newSlug = await getActiveBtc15mSlug();
              if (newSlug !== this.marketSlug) {
                const next = await Btc15mArbBot.create(this.settings);
                Object.assign(this, next);
                break;
              }
            } catch {
              /* */
            }
            await sleep(10000);
            break;
          }

          const now = Date.now() / 1000;
          if (now - lastEval < evalMinIntervalS) continue;
          lastEval = now;
          evalCount += 1;

          const yesState = client.getBook(this.yesTokenId);
          const noState = client.getBook(this.noTokenId);
          if (!yesState || !noState) continue;

          const [yesBids, yesAsks] = yesState.toLevels();
          const [noBids, noAsks] = noState.toLevels();
          if (!yesAsks.length || !noAsks.length) continue;

          const upBook = this._bookFromState(yesBids, yesAsks) as Record<string, unknown>;
          const downBook = this._bookFromState(noBids, noAsks) as Record<string, unknown>;

          const priceUp = upBook.best_ask as number | undefined;
          const priceDown = downBook.best_ask as number | undefined;
          const totalCost = priceUp != null && priceDown != null ? priceUp + priceDown : null;
          this.emit("market_update", {
            upPrice: priceUp,
            downPrice: priceDown,
            totalCost,
            balance: this.cachedBalance,
            timeRemaining: this.getTimeRemaining(),
            marketSlug: this.marketSlug,
          });

          const opportunity = this.checkArbitrage(upBook, downBook);
          if (opportunity) {
            await this.executeArbitrage(opportunity);
            continue;
          }
          const sizeUp = (upBook.ask_size as number) ?? 0;
          const sizeDown = (downBook.ask_size as number) ?? 0;
          if (priceUp != null && priceDown != null) {
            const bestTotal = priceUp + priceDown;
            const asksUp = (upBook.asks as [number, number][]) ?? [];
            const asksDown = (downBook.asks as [number, number][]) ?? [];
            const fillUp = this._computeBuyFill(asksUp, Number(this.settings.orderSize));
            const fillDown = this._computeBuyFill(asksDown, Number(this.settings.orderSize));
            let fillMsg = "";
            if (fillUp && fillDown && fillUp.worst != null && fillDown.worst != null) {
              const worstTotal = fillUp.worst + fillDown.worst;
              fillMsg = fillUp.vwap != null && fillDown.vwap != null
                ? ` | fill(worst)=$${worstTotal.toFixed(4)} vwap=$${(fillUp.vwap + fillDown.vwap).toFixed(4)}`
                : ` | fill(worst)=$${worstTotal.toFixed(4)}`;
            }
            console.log(
              `No arbitrage: UP=$${priceUp.toFixed(4)} (${sizeUp}) + DOWN=$${priceDown.toFixed(4)} (${sizeDown}) = $${bestTotal.toFixed(4)} (threshold=${this.settings.targetPairCost.toFixed(3)})${fillMsg} [Time: ${this.getTimeRemaining()}]`
            );
          }
        }
      } catch (e) {
        console.warn("WSS monitor loop error, reconnecting:", e);
        await sleep(1000);
      }
    }
  }
}

export async function main(): Promise<void> {
  const { loadSettings } = await import("./config");
  const settings = loadSettings();
  if (!settings.privateKey?.trim()) {
    console.error("POLYMARKET_PRIVATE_KEY not configured in .env");
    process.exit(1);
  }
  try {
    const bot = await Btc15mArbBot.create(settings);
    await bot.monitor(0);
  } catch (e) {
    console.error("Fatal error:", e);
    process.exit(1);
  }
}
