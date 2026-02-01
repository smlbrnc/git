# Web Tabanlı Yönetim — Gereksinimler ve Hazırlık

**Doküman:** Web yönetim paneli gereksinimleri  
**Versiyon:** 1.0  
**Son güncelleme:** 2025-02-01  
**İlişkili:** SOP-Polymarket-Arbitrage-Project.md §4.6, SOP-Kurulum-Polymarket-Arbitrage.md §2.9

Bu doküman, Polymarket arbitraj sisteminin **web tabanlı yönetimi** için gereksinimleri ve hazırlık adımlarını tanımlar. Kurulum adımları Kurulum SOP §2.9 ve §4.1.6’da yer alır.

---

## 1. Amaç

- Dashboard, config, manuel kuyruk ve uyarıların **tek bir web arayüzünden** yönetilmesi  
- **Tek kullanıcı:** Tüm yetkiler (dashboard, config, kuyruk, alert, işlem modu) bu kullanıcıda  
- **İşlem modu:** Panelden **Otomatik** veya **Manuel** seçimi; otomatikte execution otomatik, manuelde sadece kullanıcı onayı ile  
- Tüm kritik aksiyonların **audit log** ile kayıt altına alınması  
- Cüzdan/emir gönderme panel üzerinden **doğrudan** yapılmaz; execution backend üzerinden, moda göre otomatik veya onay sonrası

---

## 2. Fonksiyonel Gereksinimler

### 2.1 Dashboard

| Gereksinim | Açıklama | Öncelik |
|------------|----------|---------|
| Fırsat/dk | Dakikada tespit edilen arbitraj fırsatı sayısı | Zorunlu |
| Execution/dk | Dakikada gönderilen/başarılı execution sayısı | Zorunlu |
| Execution success rate | Başarılı execution / toplam deneme oranı (%) | Zorunlu |
| Toplam PnL | Birikimli kâr/zarar (USD) | Zorunlu |
| Drawdown % | Mevcut drawdown yüzdesi | Zorunlu |
| Ortalama gecikme | Tespit → emir gönderim (ms) | Zorunlu |
| Güncelleme | 5–15 sn polling veya WebSocket ile canlı | Zorunlu |
| Grafikler | PnL zaman serisi, drawdown, gecikme dağılımı (opsiyonel) | İsteğe bağlı |

### 2.2 Config Yönetimi

| Gereksinim | Açıklama | Öncelik |
|------------|----------|---------|
| Config okuma | risk_params, execution, optimization layer 1–2–3, monitoring (hassas alanlar maskeleyerek) | Zorunlu |
| Config değişiklik | Tek kullanıcı panelden değiştirir; backend config güncellenir veya servis yeniden okur | Zorunlu |
| API key / cüzdan | Panelde **gösterilmez**; sadece “ayarlı” / “ayarlı değil” durumu | Zorunlu |

### 2.3 Manuel Doğrulama Kuyruğu

| Gereksinim | Açıklama | Öncelik |
|------------|----------|---------|
| Kuyruk listesi | Bağımlılık tespiti çıktıları (piyasa çifti, LLM çıktısı, validasyon sonucu) | Zorunlu |
| Onay / Red | Tek kullanıcı; tek veya toplu; onaylanan çiftler execution pipeline’a açılır | Zorunlu |
| Filtreleme | Tarih, durum (beklemede/onaylı/red), piyasa ID (opsiyonel) | İsteğe bağlı |

### 2.4 Uyarı Yönetimi

| Gereksinim | Açıklama | Öncelik |
|------------|----------|---------|
| Uyarı geçmişi | Tetiklenen uyarılar (drawdown >%15, execution <%30, IP timeout, dolum hatası); tarih, detay | Zorunlu |
| Eşik ayarları | Tek kullanıcı; drawdown_pct_gt, execution_rate_lt vb. (config/monitoring ile senkron) | Zorunlu |
| Slack / email | Entegrasyon (opsiyonel); Kurulum SOP config’te tanımlanabilir | İsteğe bağlı |

### 2.5 Audit Log

| Gereksinim | Açıklama | Öncelik |
|------------|----------|---------|
| Kayıt | Config değişikliği (kim, zaman, hangi alan, eski/yeni değer özeti); manuel kuyruk onay/red (kim, hangi çift, karar) | Zorunlu |
| Görüntüleme | Tek kullanıcı; filtreleme tarih, aksiyon tipi | Zorunlu |
| Dışa aktarma | CSV/JSON (isteğe bağlı) | İsteğe bağlı |

---

## 3. Yetkilendirme ve Güvenlik

### 3.1 Tek Kullanıcı

Sistem **tek kullanıcı** ile çalışır. Bu kullanıcı panel üzerinden:

- Dashboard görüntüleme  
- Config okuma ve değişiklik  
- Manuel doğrulama kuyruğu onay/red  
- Alert eşikleri yönetimi  
- **İşlem modu (Otomatik / Manuel)** ayarı  

Kimlik doğrulama: tek kullanıcı adı + şifre veya token (JWT/session). Rol ayrımı yoktur.

### 3.2 İşlem Modu (Otomatik / Manuel)

Panelden seçilen **işlem modu** execution davranışını belirler:

| Mod | Davranış |
|-----|----------|
| **Otomatik** | Uygun fırsatlar (Layer 3 + risk limitleri geçen) otomatik execution'a gönderilir. |
| **Manuel** | Fırsatlar listelenir; execution **sadece kullanıcı panelden "Gönder" / "Onayla"** dediğinde yapılır. Tek tek veya toplu onay. |

Mod değişikliği anında uygulanır ve audit log'a yazılır.

### 3.3 Kimlik Doğrulama

- **Zorunlu:** Kullanıcı adı + şifre veya token (JWT/session); şifre karma (bcrypt/argon2).
- **İsteğe bağlı:** SSO (OAuth2/OIDC), 2FA.
- Oturum süresi: config’te (örn. 60 dk); uzun süre işlem yoksa çıkış.

### 3.4 Güvenlik

- **HTTPS** zorunlu (production).
- Secret’lar (DB şifre, JWT secret, API key’ler) **ortam değişkeni** veya secret manager; kod içinde veya repo’da **saklanmaz**.
- Panel API’ye **rate limit** (örn. 60 istek/dk kullanıcı başı); brute force önlemi.
- CORS: sadece bilinen origin’ler (production’da panel domain’i).

---

## 4. Teknik Hazırlık (Özet)

| Bileşen | Öneri | Not |
|---------|--------|-----|
| Backend API | FastAPI / Flask / Node (Express) | Metrikler, config CRUD, kuyruk, audit log endpoint’leri |
| Frontend | React / Vue / Svelte veya basit HTML+JS | Dashboard, config, kuyruk, alert sayfaları |
| Auth | JWT veya session (cookie); tek kullanıcı | Rol ayrımı yok |
| Veri | Mevcut pipeline’dan metrik okuma (DB, Redis, dosya); config dosya veya DB | Panel kendi veritabanı sadece kullanıcı/audit için kullanılabilir |
| Deployment | Panel ayrı process veya aynı host’ta reverse proxy (örn. /admin) | Production’da HTTPS ve ayrı port/domain |

Detaylı kurulum adımları için **SOP-Kurulum-Polymarket-Arbitrage.md §2.9** ve **config/web_admin.yaml** örneği kullanılır.

---

## 5. Kabul Kriterleri (Web Panel)

- [ ] Tüm roller (viewer, operator, admin) tanımlı ve yetkiler doğru çalışıyor  
- [ ] Dashboard’da zorunlu metrikler gerçek zamanlı (veya 5–15 sn gecikmeli) görünüyor  
- [ ] Config sayfasından sadece okuma yapılabiliyor; Admin onaylı değişiklik backend’e yansıyor  
- [ ] Manuel kuyruk listeleniyor; onay/red işlemleri audit log’a yazılıyor  
- [ ] Uyarı geçmişi görüntülenebiliyor; Admin eşikleri güncelleyebiliyor  
- [ ] HTTPS, secret yönetimi ve rate limit production’da aktif  
- [ ] API key ve cüzdan bilgisi panelde hiçbir sayfada gösterilmiyor  

---

## 6. Referanslar

- SOP-Polymarket-Arbitrage-Project.md — §4.6 Web Tabanlı Yönetim  
- SOP-Kurulum-Polymarket-Arbitrage.md — §2.9 Web Tabanlı Yönetim Paneli Kurulumu, §4.1.6  
- article-en.md — Part V: The Monitoring Dashboard (metrikler ve uyarılar)
