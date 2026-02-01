#!/usr/bin/env bash
# Streamlit'i proje dizininde .streamlit kullanacak şekilde çalıştırır (~/.streamlit izin hatasını önler).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export HOME="$ROOT"
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
export POLYMARKET_ROOT="$ROOT"
cd "$ROOT"
PYTHON="$ROOT/.venv/bin/python"
[ -x "$PYTHON" ] || PYTHON="python3"
exec "$PYTHON" -m streamlit run "$ROOT/scripts/dashboard.py" "$@"
