"""Alchemy Polygon: eth_getLogs parçalı çekme (Free plan: 10 blok/istek)."""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def fetch_logs_chunked(rpc_url, contract_address, from_block, to_block, max_blocks_per_request=10):
    """
    from_block..to_block aralığını max_blocks_per_request'lık parçalara bölüp get_logs çeker.
    Free plan: 10 blok/istek. Yields (log, ...) yerine tüm log listesini döner.
    """
    from web3 import Web3
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise RuntimeError("Polygon RPC'ye bağlanılamadı")
    contract = Web3.to_checksum_address(contract_address)
    all_logs = []
    start = from_block
    while start <= to_block:
        end = min(start + max_blocks_per_request - 1, to_block)
        logs = w3.eth.get_logs({
            "address": contract,
            "fromBlock": start,
            "toBlock": end,
        })
        all_logs.extend(logs)
        start = end + 1
    return all_logs
