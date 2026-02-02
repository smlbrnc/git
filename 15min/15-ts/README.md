# BTC 15-Minute Polymarket Arbitrage Bot

Polymarket'te Bitcoin 15 dakikalık marketlerde arbitraj fırsatlarını otomatik olarak bulan ve işlem yapan bot.

## 🚀 Özellikler

- ✅ Gerçek zamanlı arbitraj fırsatı tespiti
- ✅ WebSocket ve Polling desteği
- ✅ Otomatik market geçişi (15 dakika dolunca yeni market'e geçer)
- ✅ Web tabanlı monitoring arayüzü
- ✅ Dry-run modu (test için)
- ✅ Kısmi dolum risk yönetimi

## 📦 Kurulum

```bash
npm install
```

## ⚙️ Yapılandırma

`.env` dosyasını oluşturun:

```bash
cp .env.example .env
```

Gerekli değişkenleri doldurun:
- `POLYMARKET_API_KEY`, `POLYMARKET_API_SECRET`, `POLYMARKET_API_PASSPHRASE`
- `POLYMARKET_PRIVATE_KEY`, `POLYMARKET_FUNDER`
- `TARGET_PAIR_COST` (örn: 0.995)
- `ORDER_TYPE` (IOC, GTC, FOK)

## 🎮 Kullanım

### Web UI ile Başlat
```bash
npm start
```
Tarayıcıda: http://localhost:3000

### Komut Satırı Araçları
```bash
npm run check-balance    # Bakiye kontrolü
npm run check-config      # Konfigürasyon kontrolü
npm run create-api-keys   # Polymarket API key oluştur
npm run simple-order      # Test emri gönder
```

## 🔧 Ayarlar

### `.env` Parametreleri

| Parametre | Açıklama | Örnek |
|-----------|----------|-------|
| `TARGET_PAIR_COST` | Maksimum maliyet (kar marjı) | 0.995 |
| `ORDER_SIZE` | Emir boyutu (shares) | 2 |
| `ORDER_TYPE` | Emir tipi | IOC |
| `DRY_RUN` | Test modu | false |
| `USE_WSS` | WebSocket kullan | true |
| `COOLDOWN_SECONDS` | İşlemler arası bekleme | 10 |

## 📊 Web Arayüzü

Bot çalışırken http://localhost:3000 adresinde:
- Gerçek zamanlı market verileri
- Bulunan fırsatlar
- Başarılı/başarısız işlemler
- İstatistikler ve grafikler

## ⚠️ Önemli Notlar

1. **Minimum Emir Tutarı**: Polymarket her emir bacağı için minimum $1 gerektirir
2. **Signature Type**: Magic.link kullanıyorsanız `POLYMARKET_SIGNATURE_TYPE=1`
3. **Funder Address**: Proxy wallet adresinizi kullanın (profil sayfasından)
4. **Market Geçişi**: 15 dakika dolunca bot otomatik olarak yeni market'e geçer

## 🐛 Sorun Giderme

### "Invalid signature" hatası
```bash
npm run create-api-keys  # API key'leri yeniden oluştur
```

### "Insufficient balance" hatası
```bash
npm run check-balance    # Bakiyenizi kontrol edin
```

## 📝 Lisans

MIT

## ⚠️ Uyarı

Bu bot eğitim amaçlıdır. Gerçek parayla kullanmadan önce:
- Dry-run modunda test edin
- Küçük miktarlarla başlayın
- Risk yönetimini anlayın
- Polymarket fee'lerini hesaba katın
