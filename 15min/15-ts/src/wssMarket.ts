import WebSocket from "ws";

export class L2BookState {
  bids: Map<number, number> = new Map();
  asks: Map<number, number> = new Map();
  lastTimestampMs: number | null = null;
  lastHash: string | null = null;

  applySnapshot(msg: Record<string, unknown>): void {
    const bidsRaw = msg.bids ?? msg.buys ?? [];
    const asksRaw = msg.asks ?? msg.sells ?? [];

    this.bids.clear();
    this.asks.clear();

    for (const lvl of Array.isArray(bidsRaw) ? bidsRaw : []) {
      try {
        const o = lvl as Record<string, unknown>;
        const price = typeof o.price === "number" ? o.price : parseFloat(String(o.price));
        const size = typeof o.size === "number" ? o.size : parseFloat(String(o.size));
        if (Number.isFinite(price) && Number.isFinite(size) && size > 0) this.bids.set(price, size);
      } catch {
        /* skip */
      }
    }
    for (const lvl of Array.isArray(asksRaw) ? asksRaw : []) {
      try {
        const o = lvl as Record<string, unknown>;
        const price = typeof o.price === "number" ? o.price : parseFloat(String(o.price));
        const size = typeof o.size === "number" ? o.size : parseFloat(String(o.size));
        if (Number.isFinite(price) && Number.isFinite(size) && size > 0) this.asks.set(price, size);
      } catch {
        /* skip */
      }
    }

    const ts = msg.timestamp;
    if (ts != null) {
      const n = typeof ts === "number" ? ts : parseInt(String(ts), 10);
      if (Number.isFinite(n)) this.lastTimestampMs = n;
    }
    if (msg.hash != null) this.lastHash = String(msg.hash);
  }

  applyPriceChanges(msg: Record<string, unknown>): void {
    const ts = msg.timestamp;
    if (ts != null) {
      const n = typeof ts === "number" ? ts : parseInt(String(ts), 10);
      if (Number.isFinite(n)) this.lastTimestampMs = n;
    }

    const changes = msg.price_changes;
    const arr = Array.isArray(changes) ? changes : [];
    for (const ch of arr) {
      if (!ch || typeof ch !== "object") continue;
      const o = ch as Record<string, unknown>;
      try {
        const price = typeof o.price === "number" ? o.price : parseFloat(String(o.price));
        const size = typeof o.size === "number" ? o.size : parseFloat(String(o.size));
        const side = String(o.side ?? "").toUpperCase();
        const book = side === "BUY" ? this.bids : this.asks;
        if (size <= 0) book.delete(price);
        else book.set(price, size);
        if (o.hash != null) this.lastHash = String(o.hash);
      } catch {
        /* skip */
      }
    }
  }

  toLevels(): [ [number, number][], [number, number][] ] {
    const bidLevels = [...this.bids.entries()]
      .filter(([, s]) => s > 0)
      .sort((a, b) => b[0] - a[0]);
    const askLevels = [...this.asks.entries()]
      .filter(([, s]) => s > 0)
      .sort((a, b) => a[0] - b[0]);
    return [bidLevels, askLevels];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MarketWssClient {
  wsBaseUrl: string;
  assetIds: string[];
  private _books: Map<string, L2BookState> = new Map();

  constructor(options: { wsBaseUrl: string; assetIds: string[] }) {
    this.wsBaseUrl = options.wsBaseUrl.replace(/\/$/, "");
    this.assetIds = options.assetIds;
    for (const id of options.assetIds) this._books.set(id, new L2BookState());
  }

  getBook(assetId: string): L2BookState | undefined {
    return this._books.get(assetId);
  }

  async *run(): AsyncGenerator<[string, string]> {
    const url = `${this.wsBaseUrl}/ws/market`;
    let lastConnectLog = 0;

    const logThrottled = (msg: string): void => {
      const now = Date.now() / 1000;
      if (now - lastConnectLog >= 10) {
        console.log(msg);
        lastConnectLog = now;
      }
    };

    while (true) {
      try {
        logThrottled(`[WSS] Connecting to ${url}...`);
        const ws = new WebSocket(url, { handshakeTimeout: 10000 });

        await new Promise<void>((resolve, reject) => {
          ws.on("open", () => resolve());
          ws.on("error", reject);
        });

        ws.send(JSON.stringify({ assets_ids: this.assetIds, type: "MARKET" }));
        console.log(`[WSS] Subscribed to ${this.assetIds.length} asset_ids`);

        const queue: [string, string][] = [];
        let resolveWait: (() => void) | null = null;
        const waitNext = (): Promise<void> => new Promise((r) => { resolveWait = r; });

        ws.on("message", (data: WebSocket.RawData) => {
          try {
            const raw = typeof data === "string" ? data : data.toString();
            const payload = JSON.parse(raw) as unknown;
            const msgs = Array.isArray(payload) ? payload : [payload];
            for (const msg of msgs) {
              if (!msg || typeof msg !== "object") continue;
              const m = msg as Record<string, unknown>;
              const eventType = m.event_type as string | undefined;
              const assetId = m.asset_id as string | undefined;

              if (eventType === "book" && assetId && this._books.has(assetId)) {
                this._books.get(assetId)!.applySnapshot(m);
                queue.push([assetId, eventType]);
              } else if (eventType === "price_change") {
                const changes = (m.price_changes ?? []) as Record<string, unknown>[];
                const ts = m.timestamp;
                for (const ch of changes) {
                  if (!ch || typeof ch !== "object") continue;
                  const aid = ch.asset_id as string | undefined;
                  if (!aid || !this._books.has(aid)) continue;
                  this._books.get(aid)!.applyPriceChanges({ timestamp: ts, price_changes: [ch] });
                  queue.push([aid, eventType]);
                }
              }
            }
            if (resolveWait) {
              resolveWait();
              resolveWait = null;
            }
          } catch {
            /* ignore parse error */
          }
        });

        ws.on("close", () => { if (resolveWait) resolveWait(); });
        ws.on("error", () => { if (resolveWait) resolveWait(); });

        while (ws.readyState === WebSocket.OPEN) {
          while (queue.length > 0) {
            const item = queue.shift()!;
            yield item;
          }
          await waitNext();
        }
      } catch (err) {
        const code = (err as { code?: number }).code;
        const reason = (err as { reason?: string }).reason;
        let extra = "";
        if (code != null) extra += ` code=${code}`;
        if (reason) extra += ` reason=${reason}`;
        console.error(`[WSS] Connection error (${(err as Error).name}: ${(err as Error).message})${extra}; retrying...`);
        await sleep(1000);
      }
    }
  }
}
