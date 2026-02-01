# SOP Uyum Kontrolü — Kripto Odaklı Proje

**Referans:** SOP-Polymarket-Arbitrage-Project.md (SOP-PM-ARB-001)  
**Tarih:** 2025-02-01  
**Proje kullanımı:** **Kripto (BTC, ETH, SOL)** için kullanılır. Risk, izleme ve web yönetim prosedürleri SOP ile aynı ruhta uygulanır; Polymarket modülleri referans/opsiyonel kalır.

---

## 1. SOP Kapsamı (Özet)

SOP-PM-ARB-001 **sadece Polymarket tahmin piyasası arbitrajını** kapsar:

- Veri hattı (WebSocket + Alchemy/Polygon)
- Bağımlılık tespiti (LLM, manuel kuyruk)
- Optimizasyon (Layer 1 LCMM, Layer 2 Frank-Wolfe+Gurobi, Layer 3 execution validation)
- Execution (CLOB, paralel bacaklar, %50 OB sınırı)
- İzleme (fırsat/dk, execution/dk, PnL, drawdown, gecikme)
- Web yönetim (dashboard, config, audit log, işlem modu)

SOP metninde **BTC, ETH, SOL veya genel kripto spot/futures** için ayrı kural, aşama veya prosedür **yoktur**.

---

## 2. Polymarket Tarafı — SOP Uyumu

| SOP Bölüm | Proje Durumu | Uyum |
|-----------|--------------|------|
| **Faz 1** (Araştırma/Tasarım) | Konsept notu, veri gereksinimleri, risk_params, LLM (Gemini) | Uyumlu |
| **Faz 2.1–2.3** | Veri hattı (WS, Alchemy), bağımlılık, Layer 1 LCMM | Uyumlu |
| **Faz 2.4** | Layer 2 Frank-Wolfe + Gurobi | Yok (opsiyonel) |
| **Faz 2.5–2.7** | Layer 3 validation, order stub, pozisyon %50 OB | Uyumlu |
| **Faz 2.8** | İzleme: fırsat/dk, execution/dk, PnL, drawdown, gecikme, grafikler | Uyumlu |
| **Faz 2.9** | Web yönetim: config, kuyruk, audit log, giriş | Uyumlu |
| **§4.5** İzleme eşikleri | Drawdown >%15, execution rate <%30 → alert | Uyumlu |
| **§4.6** Web yönetim | Dashboard, config düzenleme, audit, tek kullanıcı (WEB_ADMIN_SECRET) | Uyumlu |
| **§4.6.3** İşlem modu | Panel: paper/live (Otomatik/Manuel ayrımı kısmen farklı isimlendirme) | Kısmen uyumlu |
| **§5** Risk limitleri | risk_params.yaml, min marj, max drawdown | Uyumlu |

**Sonuç (Polymarket):** Proje, SOP’in Polymarket kapsamında tanımladığı aşamalar ve prosedürlerle **büyük ölçüde uyumludur**. Eksik: Layer 2 (opsiyonel); işlem modu panelde “paper/live” olarak geçiyor, SOP’te “Otomatik/Manuel” ifadesi var.

---

## 3. Kripto (BTC, ETH, SOL) — Proje Ana Kapsamı

| Konu | Proje durumu | SOP referansı |
|------|--------------|----------------|
| Kripto varlık listesi | `config/crypto_assets.yaml` (BTC, ETH, SOL) | — |
| Risk limitleri | `risk_params.yaml` (min marj, max drawdown, max position) | §5 ile aynı ruh |
| İzleme (PnL, drawdown, execution/dk) | Dashboard + metrics.json, monitoring.yaml | §4.5, 2.8 |
| Config değişikliği + audit log | Panelden düzenleme → audit log | §4.6 |
| Web panel (tek kullanıcı, giriş) | WEB_ADMIN_SECRET, Config, Audit log | §4.6.2, 4.6.4 |
| İşlem modu (paper/live) | execution_mode.json, panelden seçim | §4.6.3 |

**Sonuç (Kripto):** Proje **kripto için** yapılandırılmıştır. SOP’te kripto ayrı bölüm olarak yok; risk, izleme ve yönetim prosedürleri SOP-PM-ARB-001 ile **aynı ruhta** uygulanır (limitler, audit, panel).

---

## 4. Genel Değerlendirme

- **Kripto (ana kullanım):** Proje kripto için kullanılır; risk, izleme ve web yönetimi SOP ile **aynı ruhta** (limitler, audit, config, tek kullanıcı).
- **Polymarket:** Referans/opsiyonel; SOP-PM-ARB-001 ile uyumlu modüller mevcut (Layer 2 hariç).

---

## 5. Öneriler

1. **Kripto:** Mevcut yapı (crypto_assets, risk_params, monitoring, audit) kripto kullanımı için yeterli; ileride exchange API eklenince aynı prosedürler uygulanır.
2. **İşlem modu:** Panelde “paper/live” kullanılıyor; SOP’te “Otomatik/Manuel” ifadesi var — isimlendirme istenirse panelde güncellenebilir.

---

## 6. Referanslar

- SOP-Polymarket-Arbitrage-Project.md
- docs/06-web-yonetim-gereksinimleri.md
- docs/11-kripto-varliklar.md
- config/crypto_assets.yaml
