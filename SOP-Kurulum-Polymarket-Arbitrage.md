# SOP: Polymarket Arbitraj Sistemi — Kurulum ve Ayarlar

**Doküman kodu:** SOP-PM-KUR-001  
**Versiyon:** 1.0  
**Son güncelleme:** 2025-02-01  
**İlişkili doküman:** SOP-Polymarket-Arbitrage-Project.md (SOP-PM-ARB-001)

Bu doküman, tüm proje fazlarını **sırayla** kurulum ve gerekli ayarlarla tamamlamak için adım adım rehberdir. Her faz bitmeden sonrakine geçilmez.

---

## Genel Kurulum Sırası

```
Faz 1 (Araştırma/Tasarım) → Kapı 1 onayı
    ↓
Faz 2 (Geliştirme)        → Kapı 2 onayı (backtest/kağıt)
    ↓
Faz 3 (Test)              → Kapı 3 onayı (KPI’lar sağlandı)
    ↓
Faz 4 (Üretim)            → Canlı işletme
```

---

# FAZ 1: Araştırma ve Tasarım — Kurulum

## 1.1 Ortam ve Doküman Hazırlığı

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 1.1.1 | Çalışma dizini oluştur | `polymarket/` altında: `docs/`, `config/`, `scripts/`, `logs/` | Dizinler var mı? |
| 1.1.2 | Referans dokümanları topla | `article-en.md`, `article-tr.md`, arXiv:2508.03474, arXiv:1606.02825 PDF | Tüm linkler açılıyor mu? |
| 1.1.3 | Konsept notu şablonu | `docs/01-konsept-notu.md`: matematik özeti (politop, Bregman, Frank-Wolfe), makale bulguları | Şablon dolduruldu mu? |

## 1.2 API ve Altyapı İncelemesi

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 1.2.1 | Polymarket CLOB API | Docs: endpoint’ler, auth, rate limit (req/dk), WebSocket URL | Not: rate limit değeri |
| 1.2.2 | Alchemy (Polygon) | Kayıt / API key; rate limit, kota; contract `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` event’leri | API key alındı mı? |
| 1.2.3 | Veri gereksinimleri dokümanı | `docs/02-veri-gereksinimleri.md`: canlı (OB, trade feed), tarihsel (OrderFilled, PositionSplit, PositionsMerge) | Dosya güncel mi? |

## 1.3 IP Çözücü (Gurobi) Kararı

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 1.3.1 | Gurobi lisans türü | Academic (ücretsiz) / Commercial; kurulum (pip/conda + license key) | Lisans çalışıyor mu? `python -c "import gurobipy"` |
| 1.3.2 | Performans testi | Örnek IP (10–20 koşul): solve time, bellek; not al | Süre <30 sn hedef |
| 1.3.3 | Alternatif (opsiyonel) | CPLEX, HiGHS vb. değerlendir; karar `docs/03-ip-cozucu-secimi.md` | Karar dokümante edildi mi? |

## 1.4 Bağımlılık Tespiti Yaklaşımı

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 1.4.1 | LLM seçimi | Referans: DeepSeek-R1-Distill-Qwen-32B; API/key veya self-host | Erişim test edildi mi? |
| 1.4.2 | Prompt şablonu | Input: 2 piyasa + koşul açıklamaları; Output: JSON (geçerli sonuç kombinasyonları) | Örnek girdi/çıktı kaydedildi mi? |
| 1.4.3 | Doğruluk hedefi | Karmaşık çok koşullu piyasalar için ≥%80; manuel doğrulama kuyruğu tanımı | `docs/04-bagimlilik-tespiti.md` yazıldı mı? |

## 1.5 Risk Parametreleri Kararı

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 1.5.1 | Sermaye | Toplam sermaye (USD); işlem için ayrılacak max yüzde | Değer sabitlendi mi? |
| 1.5.2 | Minimum marj | Fırsat başına kâr eşiği (referans: **0.05** USD); config’e yazılacak | `config/risk_params.yaml` (veya .env) hazır mı? |
| 1.5.3 | Maksimum drawdown | Günlük/haftalık max kayıp yüzdesi (örn. %15); durdurma tetikleyicisi | Değer sabitlendi mi? |
| 1.5.4 | Tek işlem riski | Max pozisyon büyüklüğü (sermaye %’si, örn. %2) | `config/risk_params.yaml` |

## Faz 1 Kapı Kontrol Listesi

- [ ] Konsept notu ve matematik özeti tamamlandı  
- [ ] Polymarket + Alchemy dokümantasyonu incelendi; rate limit ve maliyet not edildi  
- [ ] Gurobi (veya alternatif) kuruldu ve örnek IP çözüldü  
- [ ] Bağımlılık tespiti yaklaşımı (LLM + prompt) ve doğruluk hedefi belirlendi  
- [ ] Risk parametreleri (sermaye, min marj, max drawdown, tek işlem riski) dokümante edildi  
- [ ] Go/No-Go kararı verildi ve kaydedildi  

**Kapı 1 onayı olmadan Faz 2’ye geçilmez.**

---

# FAZ 2: Geliştirme — Kurulum ve Ayarlar

## 2.1 Geliştirme Ortamı

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 2.1.1 | Python ortamı | Python 3.10+; venv veya conda; `requirements.txt` / `pyproject.toml` | `pip install -r requirements.txt` hatasız mı? |
| 2.1.2 | Bağımlılıklar | `gurobipy`, `websocket-client`, `requests`, `numpy`, `scipy`, `pandas`, (LLM SDK) | Tüm import’lar çalışıyor mu? |
| 2.1.3 | Ortam değişkenleri şablonu | `.env.example`: API key’ler, RPC URL, log seviyesi; `.env` git’e eklenmez | `.env.example` mevcut mu? |

**Örnek `.env.example`:**
```bash
# Polymarket
POLYMARKET_CLOB_API_URL=https://clob.polymarket.com
POLYMARKET_WS_URL=wss://...
# Alchemy
ALCHEMY_POLYGON_API_KEY=
ALCHEMY_POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
# Gurobi (opsiyonel, lisans dosya yolu)
GRB_LICENSE_FILE=/path/to/gurobi.lic
# Risk (override)
MIN_PROFIT_MARGIN_USD=0.05
MAX_DAILY_DRAWDOWN_PCT=15
```

## 2.2 Veri Hattı Kurulumu

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 2.2.1 | WebSocket client | Polymarket CLOB WebSocket URL; reconnect policy (exp backoff, max 5 deneme) | Bağlantı 1 dk süreyle açık mı? |
| 2.2.2 | Event buffer | Son 5–10 dk order book + trade snapshot’ları; bellek limiti (örn. 500 MB) | Config: `BUFFER_MINUTES`, `BUFFER_MAX_MB` |
| 2.2.3 | Alchemy client | Polygon RPC; contract `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`; event filtreleri (OrderFilled, PositionSplit, PositionsMerge) | Tek event çekme testi başarılı mı? |
| 2.2.4 | Rate limit | Alchemy: istek/dk sınırı; retry + jitter; kuyruk varsa log | Rate limit aşılmıyor mu? |
| 2.2.5 | Idempotency | Event ID veya (tx_hash, log_index) ile çift işleme engeli | Aynı event 2 kez işlenmiyor mu? |

**Config örneği `config/data_pipeline.yaml`:**
```yaml
websocket:
  url: "wss://..."
  reconnect_delay_min: 1
  reconnect_delay_max: 60
  reconnect_max_attempts: 5
buffer:
  minutes: 10
  max_mb: 500
alchemy:
  rate_limit_rpm: 300  # Alchemy planına göre ayarla
  contract_address: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
  events: ["OrderFilled", "PositionSplit", "PositionsMerge"]
# Makale referansı: ilişkili işlemlerin gruplanması 950 blok (~1 saat)
time_window_blocks: 950
time_window_hours_approx: 1
```

## 2.3 Bağımlılık Tespiti Modülü Kurulumu

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 2.3.1 | Piyasa çifti üretimi | N piyasa → N*(N-1)/2 çift; filtre (aynı question_id vb. hariç) | Çift sayısı makul mü? |
| 2.3.2 | LLM çağrısı | Prompt şablonu; model adı; max_tokens; temperature (düşük, örn. 0.2) | Örnek 10 çift için JSON çıktı alındı mı? |
| 2.3.3 | Validasyon | Her piyasada tam 1 TRUE koşul; geçerli kombinasyon < n×m ise bağımlılık; arbitraj koşulu kontrolü | Validasyon scripti geçiyor mu? |
| 2.3.4 | Manuel doğrulama kuyruğu | Şüpheli/kompleks çiftler için kuyruk (dosya veya DB); “onaylı” flag | Kuyruk tüketilebiliyor mu? |

**Config örneği `config/dependency_detection.yaml`:**
```yaml
llm:
  provider: "deepseek"  # veya openai, local
  model: "deepseek-r1-distill-qwen-32b"
  temperature: 0.2
  max_tokens: 1024
validation:
  require_single_true_per_outcome: true
  dependency_threshold_combinations_lt_nm: true
manual_review_queue: "data/manual_review_queue.json"
```

## 2.4 Optimizasyon Motoru — Layer 1 (LCMM)

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 2.4.1 | Kısıt seti | Olasılıklar toplamı = 1; A ⇒ B ise P(A) ≤ P(B); piyasa bazlı kısıtlar | LP matrisi doğru mu? |
| 2.4.2 | Çözücü | scipy.optimize veya cvxpy; süre hedefi <100 ms | Örnek piyasada süre ölçüldü mü? |
| 2.4.3 | Çıktı | Arbitraj var/yok; varsa kaba yön (hangi koşul al/sat) | Layer 2’ye geçiş kriteri net mi? |

**Config örneği `config/optimization_layer1.yaml`:**
```yaml
solver: "scipy"  # veya cvxpy
timeout_seconds: 0.1
constraints:
  - "sum_probabilities_one"
  - "implication_probability_bounds"
```

## 2.5 Optimizasyon Motoru — Layer 2 (Frank-Wolfe + Gurobi)

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 2.5.1 | Frank-Wolfe parametreleri | alpha=**0.9**, initial_epsilon=**0.1**, convergence_threshold=**1e-6**, time_limit=**1800** (sn, piyasa büyüklüğüne göre azaltılabilir) | Parametreler config’de mi? |
| 2.5.2 | Barrier Frank-Wolfe | M' = (1-ε)M + εu; epsilon adaptif azalma kuralı (makaledeki gibi) | Kodda epsilon güncellemesi var mı? |
| 2.5.3 | Gurobi IP | Her iterasyonda min c·z; MIPGap, TimeLimit (iterasyon başına, örn. 60 sn) | Tek iterasyon süresi ölçüldü mü? |
| 2.5.4 | Maksimum iterasyon | 50–150; convergence gap ε’dan küçükse erken çıkış | 100 iterasyonla test edildi mi? |

**Config örneği `config/optimization_layer2.yaml`:**
```yaml
frank_wolfe:
  alpha: 0.9
  initial_epsilon: 0.1
  convergence_threshold: 1.0e-6
  time_limit_seconds: 1800
  max_iterations: 150
  barrier_epsilon_adaptive: true
gurobi:
  mip_gap: 1.0e-6
  time_limit_per_iteration_seconds: 60
  thread_count: 4  # CPU’ya göre
```

## 2.6 Optimizasyon Motoru — Layer 3 (Execution Validation)

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 2.6.1 | Order book simülasyonu | Mevcut OB’de fiyat seviyelerine göre dolum simülasyonu; VWAP hesapla | VWAP formülü: Σ(price×vol)/Σ(vol) |
| 2.6.2 | Minimum marj | `MIN_PROFIT_MARGIN_USD` (0.05); simüle edilmiş kâr ≥ bu değer | Config’ten okunuyor mu? |
| 2.6.3 | Minimum likidite | Tüm bacaklarda min volume eşiği (örn. $100); `profit = deviation × min(volume across legs)` | Cap doğru uygulanıyor mu? |
| 2.6.4 | Maksimum slippage | Kabul edilebilir slippage (örn. %2); simüle kâr slippage sonrası > min marj | Red koşulu net mi? |

**Config örneği `config/optimization_layer3.yaml`:**
```yaml
min_profit_margin_usd: 0.05
min_liquidity_per_leg_usd: 100
max_slippage_pct: 2.0
vwap:
  use_orderbook_levels: true
  max_levels: 10
```

## 2.7 Execution Modülü Kurulumu

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 2.7.1 | Paralel bacak gönderimi | Tüm bacaklar aynı anda (async); hedef <30 ms arada | Zamanlama log’u var mı? |
| 2.7.2 | API/RPC | Polymarket CLOB order endpoint; auth (API key veya imzalı mesaj); Polygon tx gönderimi (gerekirse) | Testnet’te 1 emir başarılı mı? |
| 2.7.3 | Timeout | Bacak başına timeout (örn. 5 sn); bir bacak timeout’ta iptal/düzeltme prosedürü | Prosedür dokümante edildi mi? |
| 2.7.4 | Pozisyon büyüklüğü | Order book derinliğinin **%50’si** ile sınır; modifiye Kelly: f = (b×p - q)/(b×√p); cap OB %50 | Sizing config’te mi? |

**Config örneği `config/execution.yaml`:**
```yaml
order_submission:
  parallel_legs: true
  leg_timeout_seconds: 5
  max_position_pct_of_orderbook_depth: 50
position_sizing:
  method: "modified_kelly"
  execution_probability_from_orderbook: true
  cap_pct_of_depth: 50
```

## 2.8 İzleme Panosu ve Alert’ler

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 2.8.1 | Metrikler | Fırsat/dk, execution/dk, execution success rate, toplam PnL, drawdown %, ortalama gecikme (tespit→gönderim) | Her metrik loglanıyor mu? |
| 2.8.2 | Alert eşikleri | Drawdown >%15; execution rate <%30; IP timeout sayısı artışı; dolum hata artışı | Alert kanalı (email/Slack) tanımlı mı? |
| 2.8.3 | Dashboard | Grafana/Streamlit/simple HTML; gerçek zamanlı güncelleme (polling veya WS) | Sayfa açılıyor mu? |

**Config örneği `config/monitoring.yaml`:**
```yaml
metrics:
  - opportunities_per_minute
  - executions_per_minute
  - execution_success_rate
  - total_pnl
  - drawdown_pct
  - avg_latency_ms
alerts:
  drawdown_pct_gt: 15
  execution_rate_lt: 30
  ip_timeout_spike: true  # oran veya mutlak artış
  fill_failure_spike: true
```

## 2.9 Web Tabanlı Yönetim Paneli Kurulumu

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 2.9.1 | Backend API | Metrikler (fırsat/dk, execution/dk, success rate, PnL, drawdown, latency); config okuma; config güncelleme (onaylı); manuel kuyruk listesi + onay/red; alert eşikleri okuma/güncelleme | Endpoint’ler dokümante edildi mi? |
| 2.9.2 | Kimlik doğrulama | **Tek kullanıcı:** session veya JWT; kullanıcı adı/şifre; rol ayrımı yok | Login çalışıyor mu? |
| 2.9.3 | İşlem modu (Otomatik/Manuel) | Panelden seçim: **Otomatik** = uygun fırsatlar otomatik execution; **Manuel** = fırsatlar listelenir, kullanıcı "Gönder"/"Onayla" ile execution | Mod değişince davranış doğru mu? |
| 2.9.4 | Dashboard sayfası | Gerçek zamanlı metrikler; grafikler; alert durumu; **mevcut işlem modu** gösterimi | Sayfa hatasız açılıyor mu? |
| 2.9.5 | Config sayfası | Okuma + değişiklik (risk_params, execution, layer3 min marj vb.); tek kullanıcı; API key gösterilmez | Config değişiklik backend'e yansıyor mu? |
| 2.9.6 | Manuel kuyruk sayfası | Bağımlılık tespiti çıktıları listesi; onay/red butonu (tek kullanıcı) | Kuyruk tüketilebiliyor mu? |
| 2.9.7 | Alert sayfası | Uyarı geçmişi; eşik ayarları (tek kullanıcı); Slack/email (opsiyonel) | Alert tetiklenince görünüyor mu? |
| 2.9.8 | Güvenlik | HTTPS; secret’lar env’de; rate limit (API); audit log (config + işlem modu + kuyruk aksiyon) | Audit log yazılıyor mu? |

**Config örneği `config/web_admin.yaml`:**
```yaml
server:
  host: "0.0.0.0"
  port: 8080
  https: true  # production’da true
auth:
  method: "session"  # veya jwt
  single_user: true  # tek kullanıcı; rol ayrımı yok
  session_ttl_minutes: 60
# İşlem modu: panelden seçilir; backend bu değeri okur
execution_mode:
  default: "manual"  # veya "automatic"; panelden değiştirilebilir
  persist_path: "config/execution_mode.json"  # panel değişikliği buraya yazılır
audit_log_path: "logs/audit_web_admin.jsonl"
rate_limit_rpm: 60  # panel API istek/dk
```

## Faz 2 Kapı Kontrol Listesi

- [ ] Veri hattı (WebSocket + Alchemy) çalışıyor; event’ler loglanıyor  
- [ ] Bağımlılık tespiti (LLM + validasyon) en az 1 örnek sette test edildi  
- [ ] Layer 1–2–3 sırayla çalışıyor; Layer 3 red/onay kararı veriyor  
- [ ] Execution modülü (paralel bacak, timeout, sizing) test ortamında denendi  
- [ ] Dashboard ve alert eşikleri ayarlandı  
- [ ] Web yönetim paneli (tek kullanıcı, işlem modu otomatik/manuel, dashboard, config, manuel kuyruk, audit log) kuruldu ve test edildi  
- [ ] Backtest veya kağıt ticaret ile strateji ve latency doğrulandı  

**Kapı 2 onayı olmadan Faz 3’e geçilmez.**

---

# FAZ 3: Test ve Doğrulama — Kurulum ve Ayarlar

## 3.1 Tarihsel Veri ile Test

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 3.1.1 | Veri aralığı | En az 1 ay (tercihen Nisan 2024–2025 benzeri); Alchemy’den event çek | Event sayısı makul mü? |
| 3.1.2 | Arbitraj tespiti | Tüm koşullar + çiftler üzerinde tespit çalıştır; tespit sayısı, koşul başına oran | Rakamlar makale ile uyumlu mu? |
| 3.1.3 | Projeksiyon süreleri | Frank-Wolfe + Gurobi; piyasa büyüklüğüne göre süre (1–30 sn) | Time limit aşılmıyor mu? |

## 3.2 Kağıt Ticaret Kurulumu

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 3.2.1 | Canlı fırsatlar, emir yok | Execution modülünde “dry_run” veya “paper” modu; gerçek emir gönderilmez | `DRY_RUN=true` veya config’te `execution.mode: paper` |
| 3.2.2 | Simüle PnL | VWAP ve OB’ye göre dolum simülasyonu; kâr/zarar log’a yazılır | Günlük simüle PnL raporu var mı? |
| 3.2.3 | Süre | En az 3–7 gün kağıt ticaret; execution oranı ve latency istatistikleri | Oran ve gecikme kaydedildi mi? |

## 3.3 Küçük Sermaye ile Canlı Test

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 3.3.1 | Sermaye limiti | Küçük tutar (örn. $500–2000); config’te max pozisyon ve günlük limit | Limitler aktif mi? |
| 3.3.2 | Minimum marj | 0.05 korunur; daha seçici filtre (örn. 0.08) isteğe bağlı | Config’te doğru mu? |
| 3.3.3 | Metrikler | Gerçek PnL, başarı oranı, gas maliyeti; en az 1 hafta | KPI’lar hedeflenen aralıkta mı? |

## 3.4 Incident Playbook

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 3.4.1 | Drawdown >%15 | Otomatik: tüm yeni emirler durdur; mevcut pozisyonlar kapatma/bekleme kararı; sebep analizi | Playbook dosyası var mı? |
| 3.4.2 | Execution rate <%30 | Otomatik uyarı; inceleme: API, RPC, rakip, likidite; parametre (min marj, timeout) gözden geçir | Playbook’ta adımlar yazılı mı? |
| 3.4.3 | Doküman | `docs/05-incident-playbook.md` | İmza ve tarih |

## Faz 3 Kapı Kontrol Listesi

- [ ] Tarihsel test: tespit sayıları ve projeksiyon süreleri kabul edilebilir  
- [ ] Kağıt ticaret en az 3–7 gün yapıldı; simüle PnL ve execution oranı kaydedildi  
- [ ] Küçük sermaye ile canlı test yapıldı; gerçek PnL, başarı oranı, gas izlendi  
- [ ] Incident playbook yazıldı ve ekip tarafından biliniyor  
- [ ] KPI’lar (başarı oranı, min marj, max drawdown) hedeflenen aralıkta  

**Kapı 3 onayı olmadan Faz 4’e geçilmez.**

---

# FAZ 4: Üretim ve İşletme — Kurulum ve Ayarlar

## 4.1 Üretim Ortamı Checklist

| # | Adım | Ayarlar / Yapılacaklar | Kontrol |
|---|------|------------------------|---------|
| 4.1.1 | Sunucu / ortam | Aynı bölgede düşük gecikme (Polymarket/Polygon’a yakın); 7/24 çalışacak mı? | Bölge ve SLA kararlaştırıldı mı? |
| 4.1.2 | API anahtarları | Polymarket production key; Alchemy production key; **güvenli** saklama (secret manager) | Key’ler production env’de mi? |
| 4.1.3 | Cüzdan | İmzalama için hot wallet; bakiye (gas + işlem); çok imza veya limit (opsiyonel) | Bakiye ve limitler ayarlandı mı? |
| 4.1.4 | Config | Production config; `DRY_RUN=false`, `execution.mode=live`; risk limitleri nihai | Config review yapıldı mı? |
| 4.1.5 | Log ve rotasyon | Log seviyesi INFO; rotasyon (günlük/haftalık); log’da key veya hassas bilgi yok | Log politikası yazıldı mı? |
| 4.1.6 | Web yönetim paneli (prod) | HTTPS; auth aktif; rol atamaları nihai; audit log yedekleniyor; panel URL sadece yetkili erişim | Panel production’da erişilebilir mi? |

## 4.2 Risk Limitleri — Nihai Değerler

| Parametre | Önerilen (referans) | Config konumu | Kontrol |
|-----------|----------------------|---------------|---------|
| Min marj (USD) | 0.05 | `config/optimization_layer3.yaml` veya `.env` | Değer 0.05 mi? |
| Max günlük drawdown (%) | 15 | `config/risk_params.yaml` veya `.env` | Otomatik durdurma bağlandı mı? |
| Max tek işlem (sermaye %) | 2 | `config/execution.yaml` / risk_params | Sizing bu limiti kullanıyor mu? |
| OB derinliği cap (%) | 50 | `config/execution.yaml` | %50 aşılmıyor mu? |
| Leg timeout (sn) | 5 | `config/execution.yaml` | Timeout sonrası iptal tetikleniyor mu? |

## 4.3 Günlük / Haftalık / Aylık Prosedürler

| Sıklık | Yapılacak | Config / Doküman |
|--------|------------|-------------------|
| Günlük | Dashboard kontrolü; alert’lere yanıt; anomali notu | `logs/daily/YYYY-MM-DD.md` veya benzeri |
| Haftalık | PnL, execution oranı, IP timeout oranı, ortalama gecikme raporu | `docs/weekly/YYYY-Www.md` |
| Aylık | Risk limitleri, sermaye kullanımı, SOP uyumu, SOP güncelleme ihtiyacı | SOP-Polymarket-Arbitrage-Project.md §6 |

## Faz 4 Kapı Kontrol Listesi

- [ ] Üretim ortamı ve API/cüzdan hazır  
- [ ] Production config ve risk limitleri nihai; dry_run kapalı  
- [ ] Günlük/haftalık/aylık prosedürler ve log şablonları hazır  
- [ ] Ekip rolleri (kim dashboard, kim alert, kim incident) net  
- [ ] Web yönetim paneli production’da (HTTPS, auth, audit log) hazır  
- [ ] İlk canlı gün için “go-live” onayı verildi  

---

# Özet: Tüm Fazlar İçin Config Dosyaları

| Dosya | Faz | İçerik |
|-------|-----|--------|
| `config/risk_params.yaml` | 1, 4 | min_margin_usd, max_drawdown_pct, max_single_trade_pct |
| `config/data_pipeline.yaml` | 2 | WebSocket, buffer, Alchemy, rate limit |
| `config/dependency_detection.yaml` | 2 | LLM provider/model, prompt, manual queue |
| `config/optimization_layer1.yaml` | 2 | LCMM solver, timeout, constraints |
| `config/optimization_layer2.yaml` | 2 | Frank-Wolfe + Gurobi parametreleri |
| `config/optimization_layer3.yaml` | 2 | min marj, min likidite, max slippage, VWAP |
| `config/execution.yaml` | 2 | paralel bacak, timeout, sizing, OB %50 cap |
| `config/monitoring.yaml` | 2 | metrikler, alert eşikleri |
| `config/web_admin.yaml` | 2, 4 | web panel: auth, roller, audit log, rate limit |
| `.env` / `.env.example` | 2, 4 | API key’ler, override’lar (min marj vb.) |

---

# Versiyon Geçmişi

| Versiyon | Tarih | Değişiklik |
|----------|--------|------------|
| 1.0 | 2025-02-01 | İlk kurulum SOP; Faz 1–4 sıralı kurulum ve ayarlar |

*Bu kurulum SOP’u, SOP-Polymarket-Arbitrage-Project.md ile birlikte kullanılır. Kurulum sırasında bulunan eksikler veya iyileştirmeler dokümante edilip bir sonraki revizyonda güncellenmelidir.*
