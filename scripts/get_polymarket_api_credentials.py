#!/usr/bin/env python3
"""
Polymarket CLOB L2 credential üretir: API_KEY, API_SECRET, PASSPHRASE.
.env'de PRIVATE_KEY (0x + 64 hex) tanımlı olmalı. Çıktıyı .env'e yapıştırın.
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

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
    try:
        from py_clob_client.client import ClobClient
    except ImportError:
        print("HATA: py-clob-client kurulu değil. pip install py-clob-client python-dotenv")
        sys.exit(1)

    env = load_env()
    private_key = env.get("PRIVATE_KEY") or os.environ.get("PRIVATE_KEY")
    if not private_key:
        print("HATA: PRIVATE_KEY tanımlı değil. .env'e ekleyin (Polygon cüzdanı private key).")
        sys.exit(1)
    if not private_key.startswith("0x"):
        private_key = "0x" + private_key
    pk_hex = private_key[2:].strip()
    if len(pk_hex) != 64 or not all(c in "0123456789abcdefABCDEF" for c in pk_hex):
        print("HATA: PRIVATE_KEY geçerli formatta değil (0x + 64 hex). Cüzdan adresi kullanmayın.")
        sys.exit(1)

    host = env.get("POLYMARKET_CLOB_API_URL", "https://clob.polymarket.com")
    chain_id = int(env.get("POLYGON_CHAIN_ID", "137"))
    client = ClobClient(host, key=private_key, chain_id=chain_id)
    creds = client.create_or_derive_api_creds()

    print("Polymarket CLOB'a bağlanıldı (L1 auth).")
    print("\n--- .env dosyasına aşağıdaki satırları ekleyin veya güncelleyin ---\n")
    print(f"POLYMARKET_API_KEY={creds['apiKey']}")
    print(f"POLYMARKET_API_SECRET={creds['secret']}")
    print(f"POLYMARKET_PASSPHRASE={creds['passphrase']}")
    print("\n--- Nonce'u saklayın; credential kaybederseniz derive_api_key(nonce) ile geri alabilirsiniz ---")

if __name__ == "__main__":
    main()
