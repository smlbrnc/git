# Polymarket + Alchemy — Kripto Analizi

**Tarih:** 2026-02-01

## Polymarket Gamma API (Kripto)

- **Events endpoint:** `GET https://gamma-api.polymarket.com/events`
- **Kripto filtresi:** `tag_id=21` (Crypto kategorisi). Dokümantasyonda event'ler `tag_id` ile filtrelenir; tag listesi için "Get event tags" endpoint kullanılır.
- **Kaynak:** [Polymarket Get Events](https://docs.polymarket.com/developers/gamma-markets-api/get-events) — parametreler: `tag_id`, `limit`, `order`, `ascending`, `closed`, `active`.
- Projede **Python** (`src/polymarket_gamma.py`) ve **Node** (`src/polymarket-gamma.ts`) Gamma API ile `tag_id=21` kullanılarak kripto event'leri çekilir; başlıkta Bitcoin/Ethereum/Solana ile ek filtre uygulanır.

## Alchemy (Polygon)

- **Kullanım:** Zincir event'leri (OrderFilled, PositionSplit, PositionsMerge) — contract `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`.
- **RPC:** `ALCHEMY_POLYGON_RPC_URL` — eth_getLogs parçalı (Free plan: 10 blok/istek).
- **Kaynak:** [Alchemy Polygon API](https://docs.alchemy.com/reference/polygon-api-quickstart), [eth_getLogs](https://docs.alchemy.com/reference/eth-getlogs).
- Projede **Node** `src/alchemy-fetcher.ts` ve `src/data-pipeline.ts` ile WebSocket + Alchemy veri hattı kullanılır; **Python** `src/alchemy_fetcher.py` mevcut (pipeline'da kullanım isteğe bağlı).

## Manuel Kuyruk — Sadece Kripto

- Pipeline (Python ve Node) artık **sadece kripto event'leri** (Gamma API tag_id=21, BTC/ETH/SOL) işler; kuyruğa eklenen kayıtlar kripto piyasalarına aittir.
- Eski siyaset/Trump 2024 kayıtları aynı kuyruk dosyasında kalabilir; dashboard'da **"Sadece kripto"** kutusu işaretlendiğinde yalnızca Bitcoin/Ethereum/Solana içeren kayıtlar listelenir.
- Yeni pipeline çalıştırmalarında sadece kripto analizi kuyruğa düşer.
