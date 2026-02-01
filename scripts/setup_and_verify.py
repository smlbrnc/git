#!/usr/bin/env python3
"""
Proje kurulum ve doğrulama: dizinler, .env, config, bağımlılıklar, testler.
Kullanım: .venv/bin/python scripts/setup_and_verify.py
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

REQUIRED_DIRS = ["config", "data", "docs", "logs", "scripts", "src"]
REQUIRED_FILES = [".env", ".env.example", "requirements.txt", "config/data_pipeline.yaml", "config/dependency_detection.yaml", "config/optimization_layer1.yaml", "config/optimization_layer3.yaml", "config/execution.yaml", "config/monitoring.yaml"]
ENV_KEYS = ["POLYMARKET_WS_URL", "POLYMARKET_API_KEY", "POLYGON_RPC_URL", "GOOGLE_GEMINI_API_KEY"]

def load_env():
    env_path = ROOT / ".env"
    if not env_path.exists():
        return {}
    env = {}
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def main():
    ok = True
    print("=== Proje kurulum doğrulama ===\n")

    # Dizinler
    print("1. Dizinler")
    for d in REQUIRED_DIRS:
        p = ROOT / d
        if p.is_dir():
            print(f"   OK  {d}/")
        else:
            print(f"   EKSIK {d}/")
            ok = False
    print()

    # Dosyalar
    print("2. Dosyalar")
    for f in REQUIRED_FILES:
        p = ROOT / f
        if p.exists():
            print(f"   OK  {f}")
        else:
            print(f"   EKSIK {f}")
            ok = False
    print()

    # .env anahtarları
    print("3. .env (gerekli anahtarlar)")
    env = load_env()
    for k in ENV_KEYS:
        v = env.get(k)
        if v and len(v) > 2:
            print(f"   OK  {k}")
        else:
            print(f"   BOS/EKSIK {k}")
            ok = False
    print()

    # Bağımlılıklar (import)
    print("4. Bağımlılıklar (import)")
    for pkg, mod in [("py-clob-client", "py_clob_client"), ("web3", "web3"), ("requests", "requests"), ("websocket-client", "websocket"), ("pyyaml", "yaml")]:
        try:
            __import__(mod)
            print(f"   OK  {pkg}")
        except ImportError:
            print(f"   EKSIK {pkg}")
            ok = False
    print()

    # Test ve run scriptleri (sözdizimi)
    print("5. Test ve run scriptleri (sözdizimi)")
    for name in ["test_polymarket_ws", "test_alchemy_events", "test_gemini_dependency", "run_data_pipeline", "run_dependency_detection", "run_arbitrage_pipeline", "dashboard"]:
        p = ROOT / "scripts" / f"{name}.py"
        if p.exists():
            r = subprocess.run([sys.executable, "-m", "py_compile", str(p)], capture_output=True, timeout=5)
            if r.returncode == 0:
                print(f"   OK  scripts/{name}.py")
            else:
                print(f"   HATA scripts/{name}.py")
                ok = False
        else:
            print(f"   EKSIK scripts/{name}.py")
            ok = False
    print()

    print("=== Sonuc ===")
    if ok:
        print("Kurulum uygun. Testler icin:")
        print("  .venv/bin/python scripts/test_polymarket_ws.py   # ~30 sn")
        print("  .venv/bin/python scripts/test_alchemy_events.py")
        print("  .venv/bin/python scripts/test_gemini_dependency.py")
    else:
        print("Eksikler var; yukaridaki EKSIK/BOS maddelerini tamamlayin.")
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
