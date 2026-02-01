#!/usr/bin/env bash
# Proje başlatıcı: pipeline döngüsü (arka planda) + dashboard (önde). Ctrl+C ile ikisi de durur.
# Not: Tarayıcı sekmesi kapatıldığında terminalde WebSocketClosedError görünebilir; uygulama etkilenmez, yok sayılabilir.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export HOME="$ROOT"
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
export POLYMARKET_ROOT="$ROOT"
cd "$ROOT"

PIPELINE_PID=""
cleanup() {
  [ -n "$PIPELINE_PID" ] && kill "$PIPELINE_PID" 2>/dev/null
  exit 0
}
trap cleanup EXIT INT TERM

PYTHON="$ROOT/.venv/bin/python"
[ -x "$PYTHON" ] || PYTHON="python3"
INTERVAL="${PIPELINE_INTERVAL_SEC:-60}"

mkdir -p "$ROOT/logs"
echo "Pipeline döngüsü başlatılıyor (aralık: ${INTERVAL} sn)..."
"$PYTHON" "$ROOT/scripts/run_pipeline_loop.py" >> "$ROOT/logs/pipeline_loop.log" 2>&1 &
PIPELINE_PID=$!
sleep 2
echo "Dashboard başlatılıyor (http://localhost:8501)..."
exec "$ROOT/scripts/run_dashboard.sh" "$@"
