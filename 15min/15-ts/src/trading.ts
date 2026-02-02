import { Wallet } from "@ethersproject/wallet";
import type { SignedOrder } from "@polymarket/order-utils";
import {
  ClobClient,
  OrderType,
  Side,
  AssetType,
  type ApiKeyCreds,
  type BalanceAllowanceParams,
  type OrderBookSummary,
  type PostOrdersArgs,
  type UserOrder,
  type OpenOrder,
  type Trade,
} from "@polymarket/clob-client";
import type { Settings } from "./config";
import axios from "axios";

const HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137;

let cachedClient: ClobClient | null = null;
let interceptorInstalled = false;

function getSignatureType(settings: Settings): 0 | 1 | 2 {
  const t = settings.signatureType;
  if (t === 0 || t === 1 || t === 2) return t;
  return 1;
}

export async function getClient(settings: Settings): Promise<ClobClient> {
  if (cachedClient) return cachedClient;

  if (!settings.privateKey?.trim()) {
    throw new Error("POLYMARKET_PRIVATE_KEY is required for trading");
  }

  const signer = new Wallet(settings.privateKey.trim());
  const signatureType = getSignatureType(settings);
  const funderAddress = settings.funder?.trim() || undefined;

  // SignatureType 2: POLY_ADDRESS her zaman signer, funder sadece order.maker'da kullanılır
  // Library bunu otomatik yapıyor, interceptor'a gerek yok

  let creds: ApiKeyCreds;
  if (settings.apiKey?.trim() && settings.apiSecret?.trim() && settings.apiPassphrase?.trim()) {
    creds = {
      key: settings.apiKey.trim(),
      secret: settings.apiSecret.trim(),
      passphrase: settings.apiPassphrase.trim(),
    };
  } else {
    const tempClient = new ClobClient(HOST, CHAIN_ID, signer, undefined, signatureType, funderAddress);
    creds = await tempClient.createOrDeriveApiKey();
  }

  cachedClient = new ClobClient(HOST, CHAIN_ID, signer, creds, signatureType, funderAddress);
  return cachedClient;
}

export async function getBalance(settings: Settings): Promise<number> {
  try {
    const client = await getClient(settings);
    const params: BalanceAllowanceParams = { asset_type: AssetType.COLLATERAL };
    const result = await client.getBalanceAllowance(params);
    const balanceRaw = result?.balance ?? "0";
    const balanceWei = parseFloat(balanceRaw);
    return balanceWei / 1_000_000;
  } catch (e) {
    console.error("Error getting balance:", e);
    return 0;
  }
}

export interface PlaceOrderParams {
  side: string;
  tokenId: string;
  price: number;
  size: number;
  tif?: string;
}

export async function placeOrder(
  settings: Settings,
  params: PlaceOrderParams
): Promise<Record<string, unknown>> {
  const { side, tokenId, price, size, tif = "GTC" } = params;
  if (price <= 0 || size <= 0 || !tokenId) {
    throw new Error("price, size must be > 0 and tokenId required");
  }
  const sideUp = side.toUpperCase();
  if (sideUp !== "BUY" && sideUp !== "SELL") {
    throw new Error("side must be BUY or SELL");
  }

  const client = await getClient(settings);
  const userOrder: UserOrder = {
    tokenID: tokenId,
    price,
    size,
    side: sideUp === "BUY" ? Side.BUY : Side.SELL,
  };
  const order = await client.createOrder(userOrder, { negRisk: false });
  const orderType = tifToOrderType(tif);
  return (await client.postOrder(order, orderType)) as Record<string, unknown>;
}

function tifToOrderType(tif: string): OrderType {
  const u = (tif || "GTC").toUpperCase();
  if (u === "FOK") return OrderType.FOK;
  if (u === "FAK") return OrderType.FAK;
  if (u === "GTD") return OrderType.GTD;
  return OrderType.GTC;
}

export interface OrderSpec {
  side: string;
  token_id: string;
  price: number;
  size: number;
}

export async function placeOrdersFast(
  settings: Settings,
  orders: OrderSpec[],
  orderTypeStr = "GTC"
): Promise<Record<string, unknown>[]> {
  const client = await getClient(settings);
  const ot = tifToOrderType(orderTypeStr);

  const signedOrders: SignedOrder[] = [];
  for (const o of orders) {
    const sideUp = o.side.toUpperCase();
    const userOrder: UserOrder = {
      tokenID: o.token_id,
      price: o.price,
      size: o.size,
      side: sideUp === "BUY" ? Side.BUY : Side.SELL,
    };
    const order = await client.createOrder(userOrder, { negRisk: false });
    signedOrders.push(order);
  }

  const args: PostOrdersArgs[] = signedOrders.map((order) => ({ order, orderType: ot }));

  try {
    const result = await client.postOrders(args);
    return normalizeOrderResults(result, orders.length);
  } catch {
    const results: Record<string, unknown>[] = [];
    for (const order of signedOrders) {
      try {
        const r = await client.postOrder(order, ot);
        results.push(r as Record<string, unknown>);
      } catch (exc) {
        results.push({ error: String(exc) });
      }
    }
    return results;
  }
}

/** Batch yanıtını tek tek sipariş yanıtlarına çevirir (Polymarket bazen dizi, bazen obje döner). */
function normalizeOrderResults(result: unknown, expectedCount: number): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    const arr = result as Record<string, unknown>[];
    if (arr.length >= expectedCount) return arr;
    while (arr.length < expectedCount) arr.push({ error: "Missing response" });
    return arr;
  }
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    const ordersArr = (r.orders ?? r.results ?? r.data ?? r.successOrders) as unknown[] | undefined;
    if (Array.isArray(ordersArr) && ordersArr.length > 0) {
      const out = [...(ordersArr as Record<string, unknown>[])];
      if (out.length >= expectedCount) return out;
      const failed = (r.failedOrders as unknown[]) ?? [];
      for (let i = out.length; i < expectedCount; i++) {
        out.push((failed[i - out.length] as Record<string, unknown>) ?? { error: "Missing response" });
      }
      return out;
    }
    const orderIds = r.orderIds ?? r.order_ids;
    if (Array.isArray(orderIds))
      return orderIds.map((id: unknown) => ({ orderID: id, orderId: id }));
    if (r.orderID != null || r.orderId != null) return [r];
  }
  return [result as Record<string, unknown>];
}

export function extractOrderId(result: Record<string, unknown> | unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  for (const key of ["orderID", "orderId", "order_id", "id"]) {
    const val = r[key];
    if (val != null) return typeof val === "string" ? val : String(val);
  }
  const order = r.order as Record<string, unknown> | undefined;
  if (order && typeof order === "object") {
    const oid = order.orderID ?? order.orderId ?? order.order_id ?? order.id;
    if (oid != null) return typeof oid === "string" ? oid : String(oid);
  }
  for (const key of ["data", "result"]) {
    const nested = r[key];
    if (nested && typeof nested === "object") {
      const oid = extractOrderId(nested);
      if (oid) return oid;
    }
  }
  return null;
}

export async function getOrder(settings: Settings, orderId: string): Promise<OpenOrder> {
  const client = await getClient(settings);
  return client.getOrder(orderId);
}

export interface OrderBookResult {
  best_bid: number | null;
  best_ask: number | null;
  spread: number | null;
  bid_size: number;
  ask_size: number;
  bids: [number, number][];
  asks: [number, number][];
}

export async function getOrderBook(settings: Settings, tokenId: string): Promise<OrderBookResult> {
  const client = await getClient(settings);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const book = await client.getOrderBook(tokenId);
      const { bids, asks, best_bid, best_ask } = parseOrderBookToLevels(book);
      let bid_size = 0;
      let ask_size = 0;
      if (best_bid != null) {
        const lvl = bids.find(([p]) => p === best_bid);
        if (lvl) bid_size = lvl[1];
      }
      if (best_ask != null) {
        const lvl = asks.find(([p]) => p === best_ask);
        if (lvl) ask_size = lvl[1];
      }
      const spread = best_bid != null && best_ask != null ? best_ask - best_bid : null;
      return { best_bid, best_ask, spread, bid_size, ask_size, bids, asks };
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await sleep(500 + attempt * 500);
    }
  }
  throw lastErr;
}

export async function cancelOrders(settings: Settings, orderIds: string[]): Promise<unknown> {
  if (orderIds.length === 0) return null;
  const client = await getClient(settings);
  return client.cancelOrders(orderIds);
}

function coerceFloat(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export interface OrderStateSummary {
  status: string | null;
  filled_size: number | null;
  remaining_size: number | null;
  original_size: number | null;
  requested_size?: number;
  raw: unknown;
}

export function summarizeOrderState(
  orderData: Record<string, unknown> | OpenOrder,
  requestedSize?: number
): OrderStateSummary {
  if (!orderData || typeof orderData !== "object") {
    return { status: null, filled_size: null, remaining_size: null, original_size: null, requested_size: requestedSize, raw: orderData };
  }

  const r = orderData as Record<string, unknown>;
  const statusRaw = r.status ?? r.state ?? r.order_status;
  const status = statusRaw != null ? String(statusRaw).toLowerCase() : null;

  let filledSize: number | null = null;
  for (const key of ["filled_size", "filledSize", "size_filled", "sizeFilled", "matched_size", "matchedSize", "size_matched"]) {
    if (key in r) {
      filledSize = coerceFloat(r[key]);
      break;
    }
  }

  let remainingSize: number | null = null;
  for (const key of ["remaining_size", "remainingSize", "size_remaining", "sizeRemaining"]) {
    if (key in r) {
      remainingSize = coerceFloat(r[key]);
      break;
    }
  }

  let originalSize: number | null = null;
  for (const key of ["original_size", "originalSize", "size", "order_size", "orderSize"]) {
    if (key in r) {
      originalSize = coerceFloat(r[key]);
      break;
    }
  }

  if (filledSize == null && remainingSize != null && originalSize != null) {
    filledSize = Math.max(0, originalSize - remainingSize);
  }

  return {
    status,
    filled_size: filledSize,
    remaining_size: remainingSize,
    original_size: originalSize,
    requested_size: requestedSize,
    raw: orderData,
  };
}

const TERMINAL_STATUSES = new Set(["filled", "canceled", "cancelled", "rejected", "expired"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForTerminalOrder(
  settings: Settings,
  orderId: string,
  options: { requestedSize?: number; timeoutSeconds?: number; pollIntervalSeconds?: number } = {}
): Promise<OrderStateSummary & { terminal?: boolean; filled?: boolean }> {
  const { requestedSize, timeoutSeconds = 3, pollIntervalSeconds = 0.25 } = options;
  const start = Date.now();
  let lastSummary: OrderStateSummary & { terminal?: boolean; filled?: boolean } = {
    status: null,
    filled_size: null,
    remaining_size: null,
    original_size: null,
    requested_size: requestedSize,
    raw: {},
  };

  while ((Date.now() - start) / 1000 < timeoutSeconds) {
    try {
      const od = await getOrder(settings, orderId);
      lastSummary = { ...summarizeOrderState(od as unknown as Record<string, unknown>, requestedSize), terminal: false, filled: false };
    } catch (exc) {
      lastSummary = {
        status: "error",
        filled_size: null,
        remaining_size: null,
        original_size: null,
        requested_size: requestedSize,
        raw: { error: String(exc) },
        terminal: false,
        filled: false,
      };
    }

    const status = (lastSummary.status ?? "").toLowerCase();
    const filled = lastSummary.filled_size ?? 0;

    if (requestedSize != null && filled + 1e-9 >= requestedSize) {
      lastSummary.terminal = true;
      lastSummary.filled = true;
      return lastSummary;
    }
    if (TERMINAL_STATUSES.has(status)) {
      lastSummary.terminal = true;
      lastSummary.filled = status === "filled";
      return lastSummary;
    }

    await sleep(pollIntervalSeconds * 1000);
  }

  lastSummary.terminal = false;
  lastSummary.filled = false;
  return lastSummary;
}

export interface PositionInfo {
  size: number;
  avg_price: number;
  raw: unknown;
}

export async function getPositions(
  settings: Settings,
  _tokenIds?: string[] | null
): Promise<Record<string, PositionInfo>> {
  try {
    const client = await getClient(settings);
    const trades = await client.getTrades(undefined, true);
    const result: Record<string, PositionInfo> = {};
    for (const t of trades) {
      const tokenId = t.asset_id;
      if (!tokenId) continue;
      if (_tokenIds != null && !_tokenIds.includes(tokenId)) continue;
      const size = parseFloat(t.size) || 0;
      const price = parseFloat(t.price) || 0;
      if (!result[tokenId]) {
        result[tokenId] = { size: 0, avg_price: 0, raw: t };
      }
      const prev = result[tokenId];
      const newSize = prev.size + size;
      prev.avg_price = newSize > 0 ? (prev.avg_price * prev.size + price * size) / newSize : price;
      prev.size = newSize;
    }
    return result;
  } catch (e) {
    console.error("Error getting positions:", e);
    return {};
  }
}

export function parseOrderBookToLevels(book: OrderBookSummary): {
  bids: [number, number][];
  asks: [number, number][];
  best_bid: number | null;
  best_ask: number | null;
} {
  const bids: [number, number][] = [];
  const asks: [number, number][] = [];
  for (const b of book.bids ?? []) {
    const p = parseFloat(b.price);
    const s = parseFloat(b.size);
    if (Number.isFinite(p) && Number.isFinite(s) && s > 0) bids.push([p, s]);
  }
  for (const a of book.asks ?? []) {
    const p = parseFloat(a.price);
    const s = parseFloat(a.size);
    if (Number.isFinite(p) && Number.isFinite(s) && s > 0) asks.push([p, s]);
  }
  const bestBid = bids.length > 0 ? Math.max(...bids.map((x) => x[0])) : null;
  const bestAsk = asks.length > 0 ? Math.min(...asks.map((x) => x[0])) : null;
  return { bids, asks, best_bid: bestBid, best_ask: bestAsk };
}
