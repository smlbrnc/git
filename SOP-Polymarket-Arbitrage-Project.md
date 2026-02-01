# SOP: Polymarket Arbitraj Sistemi Projelendirme ve Yönetimi

**Doküman kodu:** SOP-PM-ARB-001  
**Versiyon:** 1.0  
**Son güncelleme:** 2025-02-01  
**Referans kaynak:** `article-en.md` (The Math Needed for Trading on Polymarket)

---

## 1. Durum Özeti

### 1.1 Ne Anlatılıyor?

Makale, Polymarket tahmin piyasalarında **garanti arbitraj** kârı elde etmek için gereken matematiksel çerçeveyi ve üretim sistemini anlatıyor. Araştırmaya göre (Nisan 2024 – Nisan 2025) sofistike aktörler **~40 milyon USD** çıkardı; en iyi tek cüzdan **~2 milyon USD** (4.049 işlem).

### 1.2 Temel Bileşenler

| Bileşen | Açıklama | Kritiklik |
|---------|----------|-----------|
| **Marjinal politop / IP** | Bağımlı koşullar nedeniyle YES+NO=1 kontrolü yetersiz; geçerli sonuçlar tamsayı programlama (IP) kısıtlarıyla modellenir. | Yüksek |
| **Bregman projeksiyonu** | Optimal arbitraj işlemi, mevcut fiyatları arbitrajsız manifolda projekte etmekle eşdeğer (KL diverjansı, LMSR). | Yüksek |
| **Frank-Wolfe** | Politop üzerinde doğrudan projeksiyon imkansız; iteratif LP + IP oracle (örn. Gurobi) ile hesaplanabilir hale getirilir. | Yüksek |
| **Execution** | CLOB atomik değil; bir bacak dolunca diğeri pahalılaşabilir. VWAP, likidite, paralel emir ve düşük gecikme şart. | Yüksek |
| **Veri + bağımlılık tespiti** | WebSocket (canlı) + Alchemy (tarihsel); çok koşullu bağımlılıklar LLM + manuel doğrulama ile taranır. | Yüksek |

### 1.3 Temel Riskler

- **Execution riski:** Tek bacak dolup diğeri dolmaz; marj $0.05 altı kenarlar genelde gas + slippage ile erir.
- **Likidite:** Kâr = (sapma) × min(tüm pozisyonlardaki volume); yetersiz derinlikte pozisyon sınırlanır.
- **Sermaye:** Araştırmadaki üst dilim ~500K+ USD ile çalışıyor; 5K USD ile aynı strateji kırılgan.
- **Gecikme:** Perakende ~2,65 sn; sofistike sistem ~2 sn + 30 ms içinde tüm bacakları aynı blokta onaylatır.

---

## 2. Kapsam ve Tanımlar

### 2.1 Kapsam

Bu SOP şunları kapsar:

- Projenin aşamalara bölünmesi (projelendirme)
- Veri hattı, bağımlılık tespiti, optimizasyon motoru, execution ve izleme süreçleri
- Risk limitleri, uyarılar ve periyodik gözden geçirme

Bu SOP şunları **kapsamaz:**

- Yatırım tavsiyesi veya hukuki/vergi danışmanlığı
- Polymarket veya üçüncü taraflarla sözleşme detayları (API, kullanım şartları kendi dokümanlarına tabidir)

### 2.2 Tanımlar

| Terim | Anlamı |
|-------|--------|
| **Arbitraj (bu bağlamda)** | YES+NO ≠ 1 (veya çok koşullu eşdeğeri) olan fırsattan garanti kâr hedeflenmesi. |
| **Bregman projeksiyonu** | θ’yı arbitrajsız manifold M üzerine, bilgi yapısına uygun (Bregman diverjansı ile) projekte etme. |
| **Execution** | Tespit edilen fırsat için emirlerin gönderilmesi, dolum ve PnL takibi. |
| **Minimum marj** | Fırsat başına kâr eşiği (referans: $0.05; gas ve slippage için tampon). |

---

## 3. Proje Aşamaları

### 3.1 Faz 1: Araştırma ve Tasarım

| Adım | İş | Çıktı | Sorumlu |
|------|-----|--------|---------|
| 1.1 | Makale + arXiv referanslarının okunması ve özetlenmesi | Konsept notu, matematik özeti | Proje lideri / Quant |
| 1.2 | Polymarket CLOB API + Alchemy dokümantasyonu incelemesi | Veri gereksinimleri, rate limit, maliyet | Mühendis |
| 1.3 | Gurobi (veya alternatif IP çözücü) lisans ve performans değerlendirmesi | Lisans seçimi, kısıt sayısı tahmini | Quant / Mühendis |
| 1.4 | Bağımlılık tespiti: LLM (örn. DeepSeek) vs kural-tabanlı prototip | Yaklaşım seçimi, doğruluk hedefi (%80+) | Quant / ML |
| 1.5 | Sermaye, risk toleransı ve minimum marj kararı | Risk parametreleri dokümanı | Proje lideri |

**Kapı:** Tasarım onayı ve “go/no-go” kararı (sermaye, yetkinlik, zaman).

### 3.2 Faz 2: Geliştirme (Build)

| Adım | İş | Çıktı | Sorumlu |
|------|-----|--------|---------|
| 2.1 | Veri hattı: WebSocket (canlı) + Polygon/Alchemy (tarihsel) | Çalışan pipeline, event log | Mühendis |
| 2.2 | Bağımlılık tespiti: piyasa çiftleri → geçerli sonuç kombinasyonları | LLM + validasyon + manuel doğrulama listesi | Quant / Mühendis |
| 2.3 | Layer 1: LCMM (basit LP gevşetmeleri) | Milisaniye seviyesinde ön filtre | Quant |
| 2.4 | Layer 2: Frank-Wolfe + Gurobi IP (Bregman projeksiyonu) | Parametre seti, zaman limiti, iterasyon sayısı | Quant |
| 2.5 | Layer 3: Execution validation (order book simülasyonu, VWAP, min marj) | Execution onay/red kararı | Quant / Mühendis |
| 2.6 | Order gönderimi: paralel bacaklar, RPC/API, timeout | Execution modülü | Mühendis |
| 2.7 | Pozisyon büyüklüğü: modifiye Kelly, execution riski, %50 OB derinliği sınırı | Sizing modülü | Quant |
| 2.8 | İzleme panosu: fırsat/dakika, execution/dakika, başarı oranı, PnL, drawdown, gecikme | Dashboard + alert tanımları | Mühendis |
| 2.9 | Web tabanlı yönetim: panel, API, yetkilendirme, config/manuel kuyruk arayüzü | Web yönetim altyapısı | Mühendis |

**Kapı:** Backtest veya kağıt ticaret ile strateji ve latency doğrulaması.

### 3.3 Faz 3: Test ve Doğrulama

| Adım | İş | Çıktı | Sorumlu |
|------|-----|--------|---------|
| 3.1 | Tarihsel veri ile arbitraj tespiti + projeksiyon (Alchemy) | Tespit sayısı, projeksiyon süreleri | Quant |
| 3.2 | Kağıt ticaret: canlı fırsatlar, gerçek emir gönderilmeden simülasyon | Slippage/VWAP tahmini, dolum oranı tahmini | Tüm ekip |
| 3.3 | Küçük sermaye ile canlı test (minimum marj ve pozisyon limitleri ile) | Gerçek PnL, başarı oranı, gas maliyeti | Proje lideri |
| 3.4 | Drawdown >%15, execution rate <%30 senaryolarında durma/düzeltme prosedürü | Incident playbook | Proje lideri |

**Kapı:** Belirlenen KPI’lar (başarı oranı, min marj, max drawdown) sağlanıyorsa tam sermaye için onay.

### 3.4 Faz 4: Üretim ve İşletme

| Adım | İş | Çıktı | Sorumlu |
|------|-----|--------|---------|
| 4.1 | Üretim ortamı, API anahtarları, cüzdan, limitler | Operasyonel checklist | Mühendis / Ops |
| 4.2 | Günlük: dashboard kontrolü, alert yanıtı | Günlük log / not | Ops / Proje lideri |
| 4.3 | Haftalık: PnL, execution oranı, IP timeout oranı, ortalama gecikme | Haftalık rapor | Proje lideri |
| 4.4 | Ay sonu: risk limitleri, sermaye kullanımı, SOP uyumu | Ay sonu gözden geçirme | Proje lideri |

---

## 4. Prosedürler (Yönetim)

### 4.1 Veri Hattı Yönetimi

1. **WebSocket:** Bağlantı koptuğunda otomatik yeniden bağlanma; son N dakika verisi buffer’da tutulur.
2. **Alchemy (veya eşdeğer):** Rate limit ve kota takibi; aşılmadan önce uyarı.
3. **Event tutarlılığı:** OrderFilled, PositionSplit, PositionsMerge için idempotency ve çift işleme kontrolü.
4. **Zaman penceresi (makale referansı):** İlişkili işlemlerin gruplanması için 950 blok (~1 saat) penceresi kullanılır; Polymarket’te eşleşen emirlerin ~%75’i bu sürede dolar.

### 4.2 Bağımlılık Tespiti Yönetimi

1. Yeni piyasalar eklendiğinde çiftler güncellenir; LLM çıktısı **manuel doğrulama** gerektirenler için kuyruğa alınır.
2. Doğruluk hedefi: karmaşık çok koşullu piyasalar için ≥%80; execution öncesi kritik çiftler manuel onaylanır.
3. LLM prompt ve model sürümü versiyonlanır; değişiklikte regresyon testi yapılır.

### 4.3 Optimizasyon Motoru Yönetimi

1. **Layer 1 (LCMM):** Constraint set ve gevşetme parametreleri dokümante edilir; değişiklikte A/B veya backtest.
2. **Layer 2 (Frank-Wolfe + Gurobi):** Alpha, epsilon, convergence threshold, time limit sabit değil; piyasa büyüklüğüne göre ayarlanabilir. Tüm parametreler config’de; değişiklik changelog’a yazılır.
3. **Layer 3:** Min marj ($0.05 referans), max slippage, min likidite eşikleri risk dokümanında tanımlı olmalı.

### 4.4 Execution Yönetimi

1. Tüm bacaklar **paralel** gönderilir; tek bacak timeout’unda diğerleri iptal/düzeltme prosedürü tetiklenir.
2. Pozisyon büyüklüğü: order book derinliğinin **%50’sini** aşmaz (piyasayı taşırma riski).
3. Gas: 4 bacaklı stratejide referans ~$0.02; min marj bu maliyeti karşılayacak şekilde seçilir.

### 4.5 İzleme ve Uyarılar

| Metrik | Normal aralık | Uyarı eşiği | Aksiyon |
|--------|----------------|-------------|---------|
| Drawdown | <%10 | >%15 | Pozisyonları düşür / durdur; sebep analizi |
| Execution rate | >%50 | <%30 | Execution path ve latency incelemesi |
| IP solver timeout | Nadir | Sık artış | Time limit veya piyasa filtreleme gözden geçir |
| Dolum hataları | Bazı kabul edilir | Ani artış | API/RPC, likidite, rakip davranışı incelemesi |
| Gecikme (tespit → gönderim) | <2 sn hedef | >3 sn sürekli | Altyapı ve kod yolu incelemesi |

---

## 4.6 Web Tabanlı Yönetim

### 4.6.1 Amaç ve Kapsam

Sistemin izlenmesi, risk limitleri ve config’in tek yerden yönetilmesi, manuel doğrulama kuyruğunun ve uyarıların web üzerinden takip edilmesi için web tabanlı yönetim paneli kullanılır.

**Kapsam:**

- Gerçek zamanlı dashboard (fırsat/dk, execution/dk, başarı oranı, PnL, drawdown, gecikme)
- Config görüntüleme ve onaylı değişiklik (risk limitleri, min marj, timeout vb.)
- Manuel doğrulama kuyruğu (bağımlılık tespiti çıktıları; onay/red)
- Uyarı geçmişi ve alert eşikleri yönetimi
- Audit log (kim, ne zaman, hangi config/aksiyon)

**Kapsam dışı:**

- Cüzdan imzalama veya doğrudan emir gönderme panel üzerinden yapılmaz; sadece izleme ve onay akışları.

### 4.6.2 Kullanıcı ve Yetkiler

Sistem **tek kullanıcı** ile çalışır. Bu kullanıcı panel üzerinden:

- **Dashboard** görüntüleme
- **Config** okuma ve değişiklik (risk limitleri, min marj, timeout vb.)
- **Manuel doğrulama kuyruğu** onay/red
- **Alert eşikleri** yönetimi
- **İşlem modu:** **Otomatik** veya **Manuel** seçimi (aşağıda)

Erişim kimlik doğrulama ile (tek kullanıcı adı/şifre veya token). Config değişikliği panelden yapılır; backend config güncellenir veya servis yeniden okur.

### 4.6.3 İşlem Modu (Otomatik / Manuel)

Yönetim panelinden **işlem modu** ayarlanır:

| Mod | Açıklama | Panel ayarı |
|-----|----------|-------------|
| **Otomatik** | Tespit edilen uygun fırsatlar otomatik execution’a gönderilir (Layer 3 onayı + risk limitleri geçerli). | Panel: "İşlem modu: Otomatik" seçili |
| **Manuel** | Fırsatlar tespit edilir ve listelenir; execution **sadece kullanıcı panelden "Gönder" / "Onayla" dediğinde** yapılır. Tek tek veya toplu onay mümkündür. | Panel: "İşlem modu: Manuel" seçili; her fırsat için onay butonu |

Mod değişikliği anında uygulanır; audit log’a yazılır (kim, ne zaman, eski mod, yeni mod).

### 4.6.4 Güvenlik ve Erişim

- Panele erişim **tek kullanıcı** kimlik doğrulama ile (session veya JWT); HTTPS zorunlu.
- API key ve cüzdan bilgisi panelde gösterilmez; sadece “ayarlı / ayarlı değil” gibi durum bilgisi.
- Tüm config değişiklikleri, **işlem modu (otomatik/manuel)** değişiklikleri ve manuel kuyruk/onay aksiyonları audit log’a yazılır (kullanıcı, zaman, değişiklik özeti).
- Detaylı gereksinimler ve kurulum adımları için `docs/06-web-yonetim-gereksinimleri.md` ve Kurulum SOP §2.9 kullanılır.

---

## 5. Risk ve Limitler

### 5.1 Operasyonel Limitler

- **Maksimum tek işlem marjinal risk:** Sermaye yüzdesi olarak tanımlanır (örn. max %2).
- **Günlük maksimum kayıp (drawdown):** Eşik aşılınca otomatik durdurma veya pozisyon küçültme.
- **Minimum marj:** Fırsat başına (referans $0.05); config’den okunur, değişiklik onay gerektirir.

### 5.2 Sermaye ve Gas

- Sermaye planlaması: Araştırma ~500K+ ile üst dilim; daha düşük sermayede strateji küçültülmeli veya daha seçici fırsat filtresi uygulanmalı.
- Gas: Sabit maliyet; min marj ve ortalama işlem büyüklüğü gas’ın kârı eritmemesini sağlayacak şekilde ayarlanır.

### 5.3 Uyum ve Dokümantasyon

- Polymarket ve Alchemy kullanım şartlarına uyum ekip sorumluluğundadır.
- Tüm parametre değişiklikleri, incident’lar ve gözden geçirme kararları loglanır (tarih, karar, sorumlu).

---

## 6. Gözden Geçirme ve Güncelleme

| Olay | Süre | İçerik | Sorumlu |
|------|------|--------|---------|
| Günlük kontrol | Her iş günü | Dashboard, uyarılar, anomali | Ops / Lider |
| Haftalık rapor | Hafta sonu | PnL, oranlar, timeout, latency | Proje lideri |
| Ay sonu review | Ayın ilk haftası | Limitler, SOP uyumu, SOP güncelleme ihtiyacı | Proje lideri |
| SOP revizyonu | İhtiyaç halinde | Versiyon artırılır; değişiklik özeti dokümanda | Proje lideri |

---

## 7. Referanslar

| Kaynak | Kullanım |
|--------|----------|
| `article-en.md` | Proje kapsamı, matematik ve sistem özeti |
| [Unravelling the Probabilistic Forest: Arbitrage in Prediction Markets](https://arxiv.org/abs/2508.03474) | Arbitraj tespiti, Bregman, Frank-Wolfe, execution metodolojisi |
| [Arbitrage-Free Combinatorial Market Making via Integer Programming](https://arxiv.org/abs/1606.02825) | Teori temeli |
| Polymarket CLOB API docs | Veri hattı ve execution arayüzü |
| Alchemy Polygon API | Tarihsel event verisi |
| Gurobi dokümantasyonu | IP parametreleri ve performans |
| `docs/06-web-yonetim-gereksinimleri.md` | Web tabanlı yönetim gereksinimleri ve hazırlık |

---

## 8. Onay

| Rol | Ad Soyad | Tarih | İmza |
|-----|----------|--------|------|
| Proje lideri | | | |
| Risk / Uyum (varsa) | | | |

*Bu SOP, projelendirme ve işletme yönetimi için rehber niteliğindedir. Yasal veya vergi tavsiyesi yerine geçmez.*
