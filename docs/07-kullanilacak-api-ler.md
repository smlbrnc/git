# Projede Kullanılacak API'ler

**Doküman:** API listesi ve kullanım amaçları  
**Versiyon:** 1.0  
**Son güncelleme:** 2025-02-01  

Bu doküman, Polymarket arbitraj projesinde kullanılacak **dış API'leri** ve **kendi backend API'mizi** özetler. Detaylar ilgili SOP ve makaleye bırakılmıştır.

---

## 1. Polymarket CLOB API

**Sağlayıcı:** Polymarket  
**Kullanım:** Canlı piyasa verisi, order book, emir gönderme  

| Tür | Amaç | Not |
|-----|------|-----|
| **REST** | Piyasa listesi, order book snapshot, emir gönderme (order endpoint) | Auth: API key veya imzalı mesaj; rate limit (req/dk) dokümantasyonda |
| **WebSocket** | Gerçek zamanlı: order book güncellemeleri (fiyat/hacim), trade/execution feed, piyasa oluşturma/settlement olayları | Düşük gecikme (<5 ms push); yeniden bağlanma politikası gerekli |

**Referans URL (örnek):** `https://clob.polymarket.com`  
**Kurulum:** SOP-Kurulum §1.2.1, §2.2.1, §2.7.2; `.env`: `POLYMARKET_CLOB_API_URL`, `POLYMARKET_WS_URL`

**Kaynak:** Polymarket CLOB API dokümantasyonu (resmi site/docs).

---

## 2. Alchemy — Polygon Node / RPC API

**Sağlayıcı:** Alchemy  
**Kullanım:** Polygon mainnet üzerinde **tarihsel event** verisi ve isteğe bağlı RPC (tx gönderimi)  

| Tür | Amaç | Not |
|-----|------|-----|
| **RPC / Node API** | Akıllı sözleşme event’lerini sorgulama | Contract: `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` |
| **Event’ler** | `OrderFilled`, `PositionSplit`, `PositionsMerge` | Backtest ve analiz için; 86M+ işlem hacmi makalede |
| **Rate limit** | İstek/dk (Alchemy planına göre); config’te `rate_limit_rpm` | Kota aşılmadan önce uyarı önerilir |

**Referans URL (örnek):** `https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY`  
**Kurulum:** SOP-Kurulum §1.2.2, §2.2.3; `.env`: `ALCHEMY_POLYGON_API_KEY`, `ALCHEMY_POLYGON_RPC_URL`

**Kaynak:** Alchemy Polygon API dokümantasyonu.

---

## 3. Polygon RPC (Emir / Tx Gönderimi)

**Kullanım:** Execution sırasında işlem (tx) gönderimi — Polymarket sözleşmeleriyle etkileşim.  

- Makalede “Direct RPC submission” (~15 ms) geçer; API yerine doğrudan RPC ile gönderim gecikmeyi azaltabilir.  
- Alchemy aynı zamanda Polygon RPC sağlayabilir; ayrı bir RPC provider (örn. public/paid Polygon RPC) da kullanılabilir.  

**Kurulum:** Execution modülü (§2.7); Polymarket CLOB order endpoint ile birlikte veya onun yerine (mimariye göre).

---

## 4. LLM API (Bağımlılık Tespiti)

**Referans model:** DeepSeek-R1-Distill-Qwen-32B (makale)  
**Kullanım:** İki piyasa + koşul açıklamaları → geçerli sonuç kombinasyonları (JSON). Bağımlılık tespiti için; manuel doğrulama ile birlikte kullanılır.  

| Seçenek | Açıklama |
|---------|----------|
| **DeepSeek API** | API key ile hosted model çağrısı |
| **Self-host / başka provider** | OpenAI, Anthropic, local model vb. — prompt ve çıktı formatı aynı kalacak şekilde |

**Kurulum:** SOP-Kurulum §1.4, §2.3; `config/dependency_detection.yaml` (provider, model, temperature, max_tokens).

---

## 5. Web Yönetim Paneli — Kendi Backend API’miz

**Kullanım:** Dashboard, config, manuel kuyruk, işlem modu (otomatik/manuel), alert eşikleri ve audit log için **iç** API. Üçüncü taraf değildir.  

| Endpoint türleri | Amaç |
|------------------|------|
| Metrikler | Fırsat/dk, execution/dk, success rate, PnL, drawdown, gecikme |
| Config | Okuma / güncelleme (risk, execution, layer3 vb.) |
| Manuel kuyruk | Listeleme, onay/red |
| İşlem modu | Otomatik / Manuel okuma ve güncelleme |
| Alert | Eşik ayarları, uyarı geçmişi |
| Audit log | Config değişiklik, mod değişikliği, kuyruk aksiyonları |

**Kurulum:** SOP-Kurulum §2.9; `config/web_admin.yaml`; auth tek kullanıcı, HTTPS, rate limit.

---

## Özet Tablo

| API | Sağlayıcı | Amaç | Zorunlu |
|-----|-----------|------|---------|
| Polymarket CLOB (REST + WebSocket) | Polymarket | Canlı OB, trade feed, emir gönderme | Evet |
| Alchemy Polygon (RPC / event’ler) | Alchemy | Tarihsel event’ler (OrderFilled, PositionSplit, PositionsMerge) | Evet |
| Polygon RPC (tx gönderimi) | Alchemy veya başka RPC | Execution’da tx; “direct RPC” ile düşük gecikme | Mimariye göre |
| LLM (DeepSeek veya alternatif) | DeepSeek / OpenAI / self-host | Bağımlılık tespiti (piyasa çifti → sonuç kombinasyonları) | Evet |
| Web panel backend API | Kendi sistemimiz | Dashboard, config, kuyruk, işlem modu, alert | Evet |

---

## API Anahtarları ve Güvenlik

- **Polymarket:** Production API key; kullanım şartlarına uyum.  
- **Alchemy:** Polygon API key; plan ve rate limit.  
- **LLM:** İlgili provider API key (DeepSeek vb.).  
- Tüm key’ler ortam değişkeni veya secret manager ile saklanır; `.env` git’e eklenmez; panelde key **gösterilmez**.  

**Referanslar:** SOP-Polymarket-Arbitrage-Project.md §5.3, §7; SOP-Kurulum §2.1.3, §4.1.2; article-en.md Part V (Data Pipeline, Resources).
