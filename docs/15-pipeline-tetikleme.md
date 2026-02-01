# Pipeline Tetikleme (Cron ve Daemon)

**İlgili:** SOP-Polymarket-Arbitrage-Project.md §4.6.3, plan: pipeline tetikleme.

Pipeline tek seferlik çalışır; otomatik işlem için periyodik tetikleme gerekir.

## Projeyi tek komutla başlatma (dashboard + pipeline)

Proje çalışırken pipeline her zaman döngüde olacak şekilde başlatmak için:

```bash
./scripts/run_all.sh
```

Bu komut pipeline döngüsünü arka planda başlatır (varsayılan 60 sn aralık), ardından dashboard'u açar. Ctrl+C ile ikisi de durur. Pipeline logları: `logs/pipeline_loop.log`. Aralığı değiştirmek: `PIPELINE_INTERVAL_SEC=120 ./scripts/run_all.sh`

**Not:** Tarayıcı sekmesi kapatıldığında veya sayfa yenilendiğinde terminalde `WebSocketClosedError` / "Task exception was never retrieved" görünebilir; uygulama etkilenmez, yok sayılabilir.

---

## Diğer yöntemler

## 1. Cron ile periyodik çalıştırma

`scripts/run_pipeline_cron.sh` pipeline'ı bir kez çalıştırır. Cron ile periyodik çağrılabilir.

**Örnek crontab (her 5 dakikada bir):**

```bash
*/5 * * * * /Users/dorukbirinci/Desktop/polymarket/scripts/run_pipeline_cron.sh >> /Users/dorukbirinci/Desktop/polymarket/logs/pipeline.log 2>&1
```

Önce script'i çalıştırılabilir yapın: `chmod +x scripts/run_pipeline_cron.sh`

## 2. Döngü (hafif daemon)

`scripts/run_pipeline_loop.py` pipeline'ı belirli aralıklarla tekrar çalıştırır. Arka planda çalıştırılabilir.

**Varsayılan aralık 60 saniye:**

```bash
./.venv/bin/python scripts/run_pipeline_loop.py
```

**Aralığı değiştirmek (örn. 120 saniye):**

```bash
PIPELINE_INTERVAL_SEC=120 ./.venv/bin/python scripts/run_pipeline_loop.py
```

Durdurmak için Ctrl+C.

## İşlem modu

Pipeline çalışırken kullanacağı mod **panelden** (dashboard) seçilir: `config/execution_mode.json` yazılır. Pipeline önce bu dosyayı okur; yoksa `.env` içindeki `EXECUTION_MODE` kullanılır. Panelden "live" seçilirse ve pipeline cron/loop ile çalışıyorsa, uygun fırsatlarda otomatik execution yapılır (SOP §4.6.3).
