"""Emir gönderimi: paper modda log, live modda Polymarket CLOB stub."""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def submit_orders_paper(legs, size_usd, reason="paper"):
    """Paper mod: emir gönderilmez, sadece log. Döner: (success: True, message)."""
    return True, f"paper:{reason} legs={len(legs)} size_usd={size_usd}"


def submit_orders_live(legs, size_usd, env, config):
    """
    Live mod: Polymarket CLOB client ile emir (stub).
    legs: list of {token_id, price, side}; size_usd: pozisyon büyüklüğü.
    """
    from src.clob_client import place_order_stub
    if not legs:
        return place_order_stub(env, token_id="stub", price=0.5, size_usd=size_usd, side="BUY")
    success_all = True
    for leg in legs:
        token_id = leg.get("token_id", "stub")
        price = leg.get("price", 0.5)
        side = leg.get("side", "BUY")
        ok, msg = place_order_stub(env, token_id, price, size_usd, side)
        if not ok:
            success_all = False
    return success_all, f"live legs={len(legs)} size_usd={size_usd}"


def submit_orders(legs, size_usd, env, config, execution_mode=None):
    """execution_mode: 'paper' | 'live'."""
    mode = execution_mode or env.get("EXECUTION_MODE", "paper")
    if mode == "paper" or env.get("DRY_RUN", "true").lower() == "true":
        return submit_orders_paper(legs, size_usd)
    return submit_orders_live(legs, size_usd, env, config)
