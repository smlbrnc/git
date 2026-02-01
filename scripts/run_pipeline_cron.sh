#!/usr/bin/env bash
# Cron ile periyodik çalıştırma: pipeline'ı bir kez çalıştırır.
# Örnek crontab: her 5 dakikada bir: */5 * * * * /path/to/scripts/run_pipeline_cron.sh >> /path/to/logs/pipeline.log 2>&1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
export POLYMARKET_ROOT="$ROOT"
cd "$ROOT"
PYTHON="$ROOT/.venv/bin/python"
[ -x "$PYTHON" ] || PYTHON="python3"
exec "$PYTHON" "$ROOT/scripts/run_arbitrage_pipeline.py"
