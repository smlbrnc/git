import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import type { Btc15mArbBot } from "./btc15mArbBot";

export interface ServerState {
  opportunities: unknown[];
  trades: unknown[];
  failedTrades: unknown[];
  marketData: unknown;
  positions: unknown;
  stats: {
    opportunitiesFound: number;
    tradesExecuted: number;
    totalInvested: number;
    totalProfit: number;
  };
}

export class BotWebServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private state: ServerState;
  private bot: Btc15mArbBot | null = null;
  private running = false;
  private monitorPromise: Promise<void> | null = null;

  constructor(port: number = 3000) {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.state = {
      opportunities: [],
      trades: [],
      failedTrades: [],
      marketData: null,
      positions: null,
      stats: { opportunitiesFound: 0, tradesExecuted: 0, totalInvested: 0, totalProfit: 0 },
    };

    this.setupRoutes();
    this.setupWebSocket();
    this.server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${port} kullanımda. Eski işlemi durdurmak için:`);
        console.error(`  lsof -ti:${port} | xargs kill`);
        console.error(`Veya farklı port: PORT=3001 npm start`);
      } else {
        console.error("Server error:", err);
      }
      process.exit(1);
    });
    this.server.listen(port, () => {
      console.log(`UI running at http://localhost:${port}`);
    });
  }

  attachBot(bot: Btc15mArbBot): void {
    this.bot = bot;

    bot.on("opportunity_found", (opp: unknown) => {
      this.state.opportunities.unshift(opp);
      this.state.opportunities = this.state.opportunities.slice(0, 50);
      this.state.stats.opportunitiesFound++;
      this.broadcast({ type: "opportunity", data: opp });
    });

    bot.on("trade_executed", (trade: { opportunity: { total_investment: number; expected_profit: number }; orderIds: string[]; timestamp: string }) => {
      this.state.trades.unshift(trade);
      this.state.trades = (this.state.trades as unknown[]).slice(0, 100);
      this.state.stats.tradesExecuted++;
      this.state.stats.totalInvested += trade.opportunity.total_investment;
      this.state.stats.totalProfit += trade.opportunity.expected_profit;
      this.broadcast({ type: "trade", data: trade });
    });

    bot.on("trade_failed", (fail: unknown) => {
      this.state.failedTrades.unshift(fail);
      this.state.failedTrades = this.state.failedTrades.slice(0, 50);
      this.broadcast({ type: "trade_failed", data: fail });
    });

    bot.on("market_update", (data: unknown) => {
      this.state.marketData = data;
      this.broadcast({ type: "market_update", data });
    });
  }

  private setupRoutes(): void {
    const publicDir = path.join(__dirname, "../public");
    this.app.use(express.static(publicDir));

    this.app.get("/api/state", (_req, res) => {
      res.json(this.state);
    });

    this.app.get("/api/status", (_req, res) => {
      res.json({ running: this.running });
    });

    this.app.post("/api/start", (_req, res) => {
      if (this.running) {
        res.status(400).json({ ok: false, error: "Zaten çalışıyor" });
        return;
      }
      if (!this.bot) {
        res.status(500).json({ ok: false, error: "Bot yok" });
        return;
      }
      this.running = true;
      this.broadcast({ type: "status", data: { running: true } });
      this.monitorPromise = this.bot.monitor(0);
      this.monitorPromise.finally(() => {
        this.running = false;
        this.monitorPromise = null;
        this.broadcast({ type: "status", data: { running: false } });
      });
      res.json({ ok: true, running: true });
    });

    this.app.post("/api/stop", (_req, res) => {
      if (!this.bot) {
        res.json({ ok: true, running: false });
        return;
      }
      this.bot.stop();
      res.json({ ok: true, running: false });
    });
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws) => {
      ws.send(JSON.stringify({ type: "initial_state", data: { ...this.state, running: this.running } }));
    });
  }

  private broadcast(message: { type: string; data: unknown }): void {
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(message));
      }
    });
  }
}
