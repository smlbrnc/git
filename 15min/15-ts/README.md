# BTC 15-Dakika Arbitraj Botu (TypeScript)

Polymarket üzerindeki **Bitcoin 15 dakikalık UP/DOWN** piyasaları için otomatik arbitraj botu. Toplam maliyet **$1.00’dan düşük** olduğunda her iki tarafı (UP + DOWN) alarak sonuca bakılmaksızın kâr kilitleme stratejisi uygular.

**Dokümantasyon**
- **[Strateji](docs/STRATEGY.md)** — Arbitrajın nasıl çalıştığı ve neden kârlı olduğu.
- **[Kullanıcı rehberi](docs/USER_GUIDE.md)** — Adım adım kurulum ve çalıştırma.

## Strateji Özeti

**Saf arbitraj:** UP + DOWN toplam maliyeti **$1.00’dan az** olduğunda her iki tarafı al; kapanışta bir taraf pay başına $1.00 öder, toplam maliyetin altında kalan kısım kâr olur.

Örnek: UP = $0.48, DOWN = $0.51 → Toplam $0.99 &lt; $1.00 → Pay başına ~$0.01 kâr.

## Kurulum

```bash
cd 15-ts
npm install
cp .env.example .env
# .env dosyasını düzenleyin (POLYMARKET_PRIVATE_KEY, API anahtarları vb.)
npm run create-api-keys   # Çıktıyı .env'e ekleyin
```

## Çalıştırma

```bash
npm run check-config   # Konfigürasyon kontrolü
npm run check-balance # USDC bakiye
npm start             # Botu başlat (DRY_RUN=true ile önce simülasyon önerilir)
```

## Scriptler

| Script | Açıklama |
|--------|----------|
| `npm start` | Botu sürekli tarama modunda başlatır |
| `npm run check-balance` | Polymarket USDC bakiyesini gösterir |
| `npm run check-config` | Cüzdan, API ve neg_risk konfigürasyonunu kontrol eder |
| `npm run create-api-keys` | API anahtarları oluşturur (.env’e eklenmeli) |
| `npm run build` | TypeScript’i `dist/` altına derler |

## Ortam Değişkenleri (.env)

- **Zorunlu:** `POLYMARKET_PRIVATE_KEY`, `POLYMARKET_API_KEY`, `POLYMARKET_API_SECRET`, `POLYMARKET_API_PASSPHRASE`
- **Magic.link (e-posta girişi):** `POLYMARKET_SIGNATURE_TYPE=1`, `POLYMARKET_FUNDER` = Polymarket proxy cüzdan adresi
- **İsteğe bağlı:** `TARGET_PAIR_COST` (varsayılan 0.99), `ORDER_SIZE`, `DRY_RUN`, `USE_WSS`, `COOLDOWN_SECONDS` vb. — `.env.example` içinde açıklamalar vardır.

## Teknoloji

- Node.js, TypeScript, `@polymarket/clob-client`, ethers, axios, ws, dotenv.

Bu proje, Python sürümünün (15/) TypeScript/Node.js ile birebir portudur.
