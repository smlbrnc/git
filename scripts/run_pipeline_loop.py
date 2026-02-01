#!/usr/bin/env python3
"""
Arbitraj pipeline'ı periyodik çalıştırır (hafif daemon).
PIPELINE_INTERVAL_SEC ortam değişkeni veya varsayılan 60 saniye.
Durdurmak için Ctrl+C.
"""
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "run_arbitrage_pipeline.py"
PYTHON = ROOT / ".venv" / "bin" / "python"
if not PYTHON.exists():
    PYTHON = sys.executable

def main():
    interval = int(os.environ.get("PIPELINE_INTERVAL_SEC", "60"))
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT) + (os.environ.get("PYTHONPATH", "") and ":" + os.environ["PYTHONPATH"] or "")
    env["POLYMARKET_ROOT"] = str(ROOT)
    print(f"Pipeline döngü başladı (aralık: {interval} sn). Durdurmak için Ctrl+C.")
    while True:
        try:
            subprocess.run([str(PYTHON), str(SCRIPT)], cwd=str(ROOT), env=env, check=False)
        except Exception as e:
            print(f"Hata: {e}")
        time.sleep(interval)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nDöngü durduruldu.")
