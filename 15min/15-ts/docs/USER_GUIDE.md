# User Guide: BTC 15-Minute Arbitrage Bot (TypeScript)

Bu rehber botu **kod yazmadan** çalıştırmak isteyenler içindir. Yapmanız gerekenler:

1. Node.js kurup bağımlılıkları yükleyin  
2. Polymarket bilgilerinizle `.env` oluşturun  
3. Kontrol komutlarını çalıştırıp botu başlatın  

---

## Başlamadan Önce

- **Polymarket hesabı** ([polymarket.com](https://polymarket.com)).
- **USDC** (Polymarket cüzdanında).
- **Private key** (Polymarket’e bağlı cüzdanın). **Magic.link (e-posta giriş)** kullanıyorsanız **proxy cüzdan adresi** de gerekir.
- Node.js 18+ ve internet bağlantısı.

---

## Adım 1: Kurulum

1. Proje klasörüne gidin:
   ```bash
   cd 15-ts
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

---

## Adım 2: .env Ayarları

1. `.env.example` dosyasını kopyalayıp `.env` yapın.

2. `.env` içinde en az şunları doldurun:

   | Değişken | Açıklama |
   |----------|----------|
   | `POLYMARKET_PRIVATE_KEY` | Cüzdan private key (0x ile başlar). **Gizli tutun.** |
   | `POLYMARKET_SIGNATURE_TYPE` | `0` = normal cüzdan (MetaMask), `1` = Polymarket e-posta girişi (Magic.link) |
   | `POLYMARKET_FUNDER` | **Sadece e-posta girişi:** Polymarket proxy cüzdan adresi. Normal cüzdanda boş bırakın. |

3. **E-posta girişi (Magic.link)** kullanıyorsanız:
   - Polymarket profilinize gidin (örn. `https://polymarket.com/@KullaniciAdiniz`).
   - "Copy address" / cüzdan adresini kopyalayın — bu **proxy** adresidir.
   - `.env` içinde `POLYMARKET_FUNDER` olarak yapıştırın.
   - `POLYMARKET_SIGNATURE_TYPE=1` yapın.

4. **API anahtarlarını oluşturun:**
   ```bash
   npm run create-api-keys
   ```
   Çıktıdaki **API Key**, **Secret** ve **Passphrase** değerlerini `.env` dosyasına ekleyin:
   - `POLYMARKET_API_KEY=...`
   - `POLYMARKET_API_SECRET=...`
   - `POLYMARKET_API_PASSPHRASE=...`

5. **Güvenlik için (isteğe bağlı):**
   - `DRY_RUN=true` — Gerçek işlem yapmadan simülasyon.
   - `TARGET_PAIR_COST=0.99` — Sadece UP+DOWN maliyeti ≤ $0.99 iken işlem (0.991, 0.995 vb. kullanılabilir).
   - `ORDER_SIZE=5` — Taraflar başına pay sayısı (küçük başlayın).

---

## Adım 3: Kurulum Kontrolü

Gerçek parayla işlem öncesi:

1. **Konfigürasyon kontrolü:**
   ```bash
   npm run check-config
   ```
   Uyarıları giderin (örn. Magic.link için `POLYMARKET_FUNDER`).

2. **Bakiye kontrolü:**
   ```bash
   npm run check-balance
   ```
   USDC bakiyenizi görmelisiniz.

---

## Adım 4: Botu Çalıştırma

1. **Simülasyon (gerçek işlem yok)**  
   `.env` içinde:
   ```
   DRY_RUN=true
   ```
   Sonra:
   ```bash
   npm start
   ```
   Bot fırsatları tarar ve *yapacağı* işlemleri loglar; gerçek emir göndermez.

2. **Canlı işlem**  
   Simülasyondan sonra:
   - `.env` içinde `DRY_RUN=false` yapın.
   - Polymarket cüzdanında USDC olduğundan emin olun.
   - Aynı komutla çalıştırın:
     ```bash
     npm start
     ```

3. **Durdurmak**  
   Terminalde **Ctrl+C** ile botu durdurun.

---

## Komut Özeti

| İşlem | Komut |
|--------|--------|
| API anahtarı oluştur / .env’e ekle | `npm run create-api-keys` |
| Cüzdan/API/konfig kontrolü | `npm run check-config` |
| USDC bakiye | `npm run check-balance` |
| Botu çalıştır (simülasyon veya canlı) | `npm start` |

---

## Sorun Giderme

- **“Invalid signature”**  
  - `npm run check-config` çalıştırıp önerileri uygulayın.  
  - E-posta girişi: `POLYMARKET_SIGNATURE_TYPE=1` ve `POLYMARKET_FUNDER` = profildeki cüzdan adresi.  
  - Anahtarları yenileyin: `npm run create-api-keys` ve `.env` güncelleyin.

- **Bakiye $0 görünüyor**  
  - Magic.link: fonlar *proxy* cüzdanda. `POLYMARKET_FUNDER` o adres olmalı.  
  - `npm run check-balance` ile kullanılan adres ve API bakiyesini kontrol edin.

- **“No active BTC 15min market found”**  
  - Piyasalar 15 dakikada bir değişir. Biraz bekleyip tekrar deneyin.  
  - https://polymarket.com/crypto/15M sayfasının açıldığını kontrol edin.

- **Bot işlem yapmıyor**  
  - Simülasyonda sadece eşik altı fırsatlarda *simülasyon* yapar.  
  - Canlıda fırsatlar hızla kaybolabilir; riski anlıyorsanız `TARGET_PAIR_COST`’u hafifçe düşürebilirsiniz (örn. 0.991).

Strateji detayı için [STRATEGY.md](STRATEGY.md), proje özeti için kök [README.md](../README.md) dosyasına bakın.
