# Kripto Varlıklar — Ana Kapsam (BTC, ETH, SOL)

**Amaç:** Proje **kripto için** kullanılır. **BTC, ETH, SOL** (ve eklenebilecek diğer varlıklar) izleme ve kontrol tek panel ve aynı risk/audit yapısıyla yönetilir.

**SOP referansı:** Risk limitleri, izleme eşikleri ve web yönetim prosedürleri SOP-Polymarket-Arbitrage-Project.md ile aynı ruhta uygulanır (drawdown, execution rate, config değişikliği, audit log). Detay: `docs/12-sop-uyum-kontrolu.md`.

---

## Kapsam

- **İzleme:** Fırsat/dk, execution/dk, PnL, drawdown, gecikme (mevcut metrikler kripto işlemleri için de kullanılır). İleride: varlık bazlı fiyat, bakiye, açık pozisyonlar (exchange/API).
- **Kontrol:** Emir gönderme, limitler (paper/live). Risk parametreleri `config/risk_params.yaml` ve panelden düzenlenir.
- **Audit:** Config değişikliği, işlem modu değişimi, kuyruk onay/red → `logs/audit.log`.

## Config

- **config/crypto_assets.yaml** — Ana varlık listesi (symbol, name, decimals). Varsayılan: BTC, ETH, SOL. Panel Config sayfasında görüntülenir.
- **config/risk_params.yaml** — min_profit_margin_usd, max_position_usd, max_drawdown_pct vb. Kripto işlemleri için de geçerli.
- **config/monitoring.yaml** — Alert eşikleri (drawdown_pct_gt, execution_rate_lt).

## Panel

- **Dashboard:** Metrikler (fırsat/dk, execution/dk, PnL, drawdown), grafikler, uyarılar.
- **Config:** Kripto varlık listesi (okuma), risk ve monitoring parametreleri (düzenleme).
- **Manuel kuyruk:** Onay bekleyen kayıtlar (onay/red → audit log).
- **Uyarılar ve geçmiş:** Anlık uyarılar + uyarı geçmişi.
- **Audit log:** Config ve aksiyon geçmişi.

## İleride

- Exchange API (Binance, Coinbase vb.) veya RPC ile fiyat/bakiye çekme.
- Kripto varlık bazlı metrikler (BTC/ETH/SOL ayrı satır veya grafik).
- Live modda gerçek emir gönderimi (exchange API).

## Referanslar

- README — Proje kapsamı (kripto odaklı)
- config/crypto_assets.yaml — Varlık listesi
- docs/12-sop-uyum-kontrolu.md — SOP uyum özeti
