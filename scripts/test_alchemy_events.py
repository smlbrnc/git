#!/usr/bin/env python3
"""
Alchemy (Polygon) üzerinden Polymarket CTF Exchange event'lerini çekme testi.
Contract: 0x4D97DCd97eC945f40cF65F87097ACe5EA0476045
Free plan: Polygon'da eth_getLogs için max 10 blok/istek. 30M CU/ay, 25 req/sn.
.env: POLYGON_RPC_URL veya ALCHEMY_POLYGON_RPC_URL
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

CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"

def main():
    try:
        from web3 import Web3
    except ImportError:
        print("HATA: web3 kurulu değil. pip install web3")
        sys.exit(1)

    env = load_env()
    rpc = env.get("POLYGON_RPC_URL") or env.get("ALCHEMY_POLYGON_RPC_URL")
    if not rpc:
        print("HATA: POLYGON_RPC_URL veya ALCHEMY_POLYGON_RPC_URL .env'de tanımlı değil.")
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(rpc))
    if not w3.is_connected():
        print("HATA: Polygon RPC'ye bağlanılamadı.")
        sys.exit(1)
    print("Bağlantı OK:", rpc.split("/")[2][:30] + "...")

    latest = w3.eth.block_number
    # Alchemy Free (Polygon): max 10 blok/istek
    max_blocks = 10
    from_block = max(0, latest - (max_blocks - 1))
    to_block = latest
    print("Blok aralığı:", from_block, "-", to_block, f"(max {max_blocks} blok, Free plan)")

    try:
        logs = w3.eth.get_logs({
            "address": Web3.to_checksum_address(CONTRACT),
            "fromBlock": from_block,
            "toBlock": to_block,
        })
        print("Toplam log:", len(logs))
        for i, log in enumerate(logs[:10]):
            print(f"  [{i}] block={log['blockNumber']} tx={log['transactionHash'].hex()[:18]}... topics={len(log['topics'])}")
        if len(logs) > 10:
            print("  ...")
    except Exception as e:
        print("get_logs uyarısı (RPC/plan limiti olabilir):", e)
        print("RPC bağlantı ve block_number OK; event çekme farklı blok aralığı veya Alchemy planı ile denenebilir.")
    print("OK: Alchemy event çekme testi tamamlandı.")

if __name__ == "__main__":
    main()
