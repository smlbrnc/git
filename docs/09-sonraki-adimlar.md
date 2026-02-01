# Sonraki Adımlar — Kripto İzleme ve Kontrol

**Kullanım:** Proje **kripto (BTC, ETH, SOL)** için kullanılır. Dashboard, risk_params, monitoring ve audit log kripto odaklıdır. Polymarket modülleri referans/opsiyonel kalır.

**Güncel:** Kurulum tamamlandı. Doğrulama: `scripts/setup_and_verify.py`. Panel: `streamlit run scripts/dashboard.py`.

---

## Tamamlananlar (Faz 2 giriş)

- **requirements.txt** — py-clob-client, web3, openai, websocket-client, pandas, pyyaml vb.
- **.env.example** — hassas değerler boş şablon.
- **config/** — `data_pipeline.yaml`, `dependency_detection.yaml`.
- **logs/**, **data/** — dizinler (.gitkeep).
- **scripts/test_polymarket_ws.py** — WebSocket bağlan, MARKET kanalına abone ol, ~30 sn mesaj al.
- **scripts/test_alchemy_events.py** — Polygon RPC ile contract log’ları (son 500 blok).
- **scripts/test_gemini_dependency.py** — 2 piyasa → Google Gemini ile geçerli kombinasyonlar (JSON).
- **scripts/setup_and_verify.py** — Kurulum doğrulama (dizinler, .env, config, bağımlılıklar, test sözdizimi).
- **src/** — Veri hattı ve bağımlılık tespiti modülleri: `config_loader`, `alchemy_fetcher`, `ws_client`, `dependency_detection`.
- **scripts/run_data_pipeline.py** — Alchemy son 30 blok (parçalı 10 blok/istek).
- **scripts/run_dependency_detection.py** — 1 piyasa çifti → Gemini → geçerli kombinasyonlar → bağımlılık kontrolü.
- **src/manual_review_queue.py** — Manuel doğrulama kuyruğu (add, get_pending, approve, reject).
- **src/optimization_layer1.py** — Layer 1 (LCMM): arbitraj var/yok (scipy linprog).
- **src/execution_validation.py** — Min marj, likidite kontrolü.
- **config/optimization_layer1.yaml**, **config/optimization_layer3.yaml**.
- **scripts/run_arbitrage_pipeline.py** — Tam akış: bağımlılık → Layer 1 → execution validation → kuyruk (paper mod).

### Kurulum (ilk kez)

```bash
cd /path/to/polymarket
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
# .env dosyasında GOOGLE_GEMINI_API_KEY, POLYMARKET_*, POLYGON_RPC_URL tanımlı olsun
.venv/bin/python scripts/setup_and_verify.py
```

### Test script’lerini çalıştırma

```bash
# venv kullan (önerilir)
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Polymarket WebSocket (~30 sn)
.venv/bin/python scripts/test_polymarket_ws.py

# Alchemy event’leri
.venv/bin/python scripts/test_alchemy_events.py

# Google Gemini bağımlılık tespiti
.venv/bin/python scripts/test_gemini_dependency.py

# Veri hattı (Alchemy parçalı)
.venv/bin/python scripts/run_data_pipeline.py

# Bağımlılık tespiti (1 çift → Gemini → validasyon)
.venv/bin/python scripts/run_dependency_detection.py

# Arbitraj pipeline (bağımlılık → Layer 1 → execution → kuyruk, paper mod)
.venv/bin/python scripts/run_arbitrage_pipeline.py
```

---

## Sırada olanlar (Faz 2 devam)

### Veri hattı (2.2) — uygulandı
- Alchemy: parçalı get_logs (10 blok/istek), `run_data_pipeline.py`.
- WebSocket: `src/ws_client.py` (reconnect); event buffer ve tam entegrasyon sonraki adım.

### Bağımlılık tespiti (2.3) — uygulandı
- Gemini REST + parse + validasyon (kombinasyon < n×m → bağımlılık), `run_dependency_detection.py`.
- Manuel doğrulama kuyruğu (data/manual_review_queue.json) sonraki adım.

### Tamamlananlar (devam)
- **2.4 Layer 1:** scipy linprog ile arbitraj var/yok; config/optimization_layer1.yaml.
- **2.6 Execution validation:** min marj, likidite; config/optimization_layer3.yaml.
- **Manuel kuyruk:** data/manual_review_queue.json (add, approve, reject).
- **run_arbitrage_pipeline.py:** bağımlılık → Layer 1 → execution → kuyruk (paper mod).

### Tamamlananlar (2.7, 2.8, 2.9)
- **2.7 Execution:** config/execution.yaml; src/position_sizing.py (OB %50 cap); src/order_submission.py (paper/live stub).
- **2.8 İzleme:** config/monitoring.yaml; src/monitoring.py (fırsat, execution, PnL, drawdown → data/metrics.json).
- **2.9 Dashboard:** scripts/dashboard.py (Streamlit); metrikler, manuel kuyruk onay/red, config özeti, işlem modu.
- **Pipeline:** run_arbitrage_pipeline.py izleme + pozisyon büyüklüğü + execution modu kullanıyor.

### Çalıştırma
```bash
# Pipeline (bağımlılık → Layer 1 → execution → kuyruk + metrikler)
.venv/bin/python scripts/run_arbitrage_pipeline.py

# Dashboard (Streamlit)
.venv/bin/streamlit run scripts/dashboard.py
```

### Tamamlananlar (CLOB + Alert)
- **src/clob_client.py** — Polymarket CLOB client hazırlığı (`get_client`, `place_order_stub`); live modda stub çağrı.
- **src/alerts.py** — Eşik kontrolü (drawdown_pct_gt, execution_rate_lt); config/monitoring.yaml.
- **src/order_submission.py** — Live modda `clob_client.place_order_stub` kullanımı.
- **src/monitoring.py** — `get_metrics()` alert listesi döner (config/monitoring.yaml eşikleri).
- **Dashboard** — Uyarılar bölümü (eşik aşımında st.warning).

### Tamamlananlar (execution mode + CLOB + README)
- **src/execution_mode.py** — get_mode(), set_mode(); config/execution_mode.json (panelden değiştirilir).
- **src/config_loader.py** — load_env() artık config/execution_mode.json ile override (EXECUTION_MODE, DRY_RUN).
- **Dashboard** — İşlem modu selectbox (paper/live); değişince set_mode() ve config yazılır.
- **src/clob_client.py** — get_client(env) PRIVATE_KEY + chain_id ile; place_order_stub → create_and_post_order (OrderArgs) iskeleti.
- **README.md** — Kurulum, komutlar, yapı, işlem modu, referanslar.

### Tamamlananlar (risk + audit + login)
- **config/risk_params.yaml** — min_profit_margin_usd, min_liquidity_per_leg_usd, max_position_usd, max_drawdown_pct, max_slippage_pct (pipeline önce buna bakar).
- **src/audit_log.py** — `append_to_audit(action, details)` → logs/audit.log.
- **İşlem modu değişimi** — set_mode() çağrıldığında audit log'a yazılır.
- **Dashboard giriş** — .env'de `WEB_ADMIN_SECRET` tanımlıysa şifre ile giriş; yoksa girişsiz erişim. Çıkış butonu.

### Sonraki fazlar (opsiyonel)
- **2.5:** Layer 2 (Frank-Wolfe + Gurobi).
- **2.9 gelişmiş:** Config düzenleme UI, alert kanalları (Slack/email).
