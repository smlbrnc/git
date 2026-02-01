"""Pozisyon büyüklüğü: OB derinliğinin cap_pct ile sınırlama."""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def size_from_orderbook_depth(depth_per_leg_usd, cap_pct=50, max_usd=None):
    """
    Her bacaktaki OB derinliğinin cap_pct'i kadar pozisyon; tüm bacaklarda min alınır.
    depth_per_leg_usd: liste veya tek değer (her bacak için USD derinlik).
    cap_pct: 50 = %50.
    max_usd: opsiyonel üst sınır (USD).
    """
    if hasattr(depth_per_leg_usd, "__iter__") and not isinstance(depth_per_leg_usd, (str, dict)):
        depths = list(depth_per_leg_usd)
    else:
        depths = [float(depth_per_leg_usd)]
    if not depths:
        return 0.0
    cap_mult = cap_pct / 100.0
    size = min(d * cap_mult for d in depths)
    if max_usd is not None and size > float(max_usd):
        size = float(max_usd)
    return max(0.0, size)
