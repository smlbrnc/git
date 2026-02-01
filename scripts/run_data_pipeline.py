#!/usr/bin/env python3
"""
Veri hattı demo: Alchemy son N blok (parçalı), opsiyonel WebSocket kısa dinleme.
Config: config/data_pipeline.yaml, .env: POLYGON_RPC_URL, POLYMARKET_WS_URL
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.config_loader import load_env, load_yaml
from src.alchemy_fetcher import fetch_logs_chunked


def main():
    env = load_env()
    cfg = load_yaml("data_pipeline")
    rpc = env.get("POLYGON_RPC_URL") or env.get("ALCHEMY_POLYGON_RPC_URL")
    contract = (cfg.get("alchemy") or {}).get("contract_address", "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045")
    max_blocks = (cfg.get("alchemy") or {}).get("max_blocks_per_request", 10)

    if not rpc:
        print("HATA: POLYGON_RPC_URL veya ALCHEMY_POLYGON_RPC_URL .env'de tanımlı değil.")
        sys.exit(1)

    from web3 import Web3
    w3 = Web3(Web3.HTTPProvider(rpc))
    latest = w3.eth.block_number
    from_block = max(0, latest - 29)
    to_block = latest
    print("Alchemy: son 30 blok (parçalı, max", max_blocks, "blok/istek)")
    print("Blok aralığı:", from_block, "-", to_block)

    logs = fetch_logs_chunked(rpc, contract, from_block, to_block, max_blocks)
    print("Toplam log:", len(logs))
    for i, log in enumerate(logs[:5]):
        print(f"  [{i}] block={log['blockNumber']} tx={log['transactionHash'].hex()[:16]}...")
    if len(logs) > 5:
        print("  ...")
    print("OK: Veri hattı (Alchemy parçalı) tamamlandı.")


if __name__ == "__main__":
    main()
