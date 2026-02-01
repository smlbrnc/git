# Veri Gereksinimleri — Polymarket Arbitraj

**İlişkili:** config/data_pipeline.yaml, docs/07-kullanilacak-api-ler.md

---

## Canlı Veri

| Kaynak | Veri | Kullanım |
|--------|------|----------|
| Polymarket CLOB WebSocket | Order book güncellemeleri, trade feed | Fiyat, derinlik, VWAP simülasyonu |
| Polymarket CLOB REST | Piyasa listesi, OB snapshot | Başlangıç verisi, filtre |

**Config:** POLYMARKET_WS_URL, buffer (dakika, max MB).

---

## Tarihsel Veri

| Kaynak | Veri | Kullanım |
|--------|------|----------|
| Alchemy (Polygon) | Contract `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` event’leri | Backtest, analiz |
| Event’ler | OrderFilled, PositionSplit, PositionsMerge | Dolum, bakiye, bağımlılık |

**Config:** POLYGON_RPC_URL, max_blocks_per_request (Free plan: 10), time_window_blocks (950).

---

## Rate Limit / Kota

- **Polymarket CLOB:** Dokümantasyonda req/dk.
- **Alchemy Free (Polygon):** 30M CU/ay, eth_getLogs max 10 blok/istek (docs/10-alchemy-free-plan.md).
