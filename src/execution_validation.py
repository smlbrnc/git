"""Execution validation (Layer 3): min marj, likidite, slippage kontrolü."""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def check_min_margin(profit_usd, min_margin_usd=0.05):
    """Simüle edilmiş kâr >= min_margin ise geçer."""
    return float(profit_usd) >= float(min_margin_usd)


def check_liquidity(min_volume_per_leg_usd, min_liquidity=100):
    """Tüm bacaklarda min volume >= min_liquidity."""
    return float(min_volume_per_leg_usd) >= float(min_liquidity)


def passes_execution_validation(profit_usd, min_volume_per_leg_usd, min_margin_usd=0.05, min_liquidity_usd=100):
    """Min marj ve min likidite kontrolü. Döner: (passed: bool, reason: str)."""
    if not check_min_margin(profit_usd, min_margin_usd):
        return False, "profit < min_margin"
    if not check_liquidity(min_volume_per_leg_usd, min_liquidity_usd):
        return False, "liquidity < min"
    return True, "ok"
