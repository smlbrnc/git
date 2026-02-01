"""
Polymarket Gamma API: kripto event/market verisi (tag_id=21 = Crypto).
Dokümantasyon: https://docs.polymarket.com/developers/gamma-markets-api/get-events
"""
import json
import urllib.request
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMMA_BASE = "https://gamma-api.polymarket.com"
CRYPTO_TAG_ID = "21"


def _parse_outcome_prices(outcome_prices):
    """outcomePrices string -> (yes, no) float tuple."""
    if not outcome_prices:
        return 0.5, 0.5
    try:
        arr = json.loads(outcome_prices) if isinstance(outcome_prices, str) else outcome_prices
        return float(arr[0]) if arr else 0.5, float(arr[1]) if len(arr) > 1 else 0.5
    except (json.JSONDecodeError, TypeError):
        return 0.5, 0.5


def fetch_events(limit=150, order="volume24hr", ascending=False):
    """Gamma API'den event listesi (tag_id=21 kripto)."""
    params = {
        "tag_id": CRYPTO_TAG_ID,
        "active": "true",
        "closed": "false",
        "limit": str(limit),
        "order": order,
        "ascending": str(ascending).lower(),
    }
    url = f"{GAMMA_BASE}/events?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "Polymarket-Arbitrage/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode())
    return data if isinstance(data, list) else []


def fetch_crypto_events(limit=150):
    """Kripto event'leri: volume24hr + id ile birleştir (tekrarsız)."""
    by_vol = fetch_events(limit=max(limit, 100), order="volume24hr", ascending=False)
    by_new = fetch_events(100, order="id", ascending=False)
    by_id = {e["id"]: e for e in by_vol}
    for e in by_new:
        if e["id"] not in by_id:
            by_id[e["id"]] = e
    return list(by_id.values())


def group_events_by_asset(events):
    """BTC, ETH, SOL başlıklı event'leri grupla."""
    btc, eth, sol = [], [], []
    for e in events:
        t = (e.get("title") or "").lower()
        if "bitcoin" in t or "btc" in t:
            btc.append(e)
        elif "ethereum" in t or "eth " in t:
            eth.append(e)
        elif "solana" in t or " sol " in t:
            sol.append(e)
    return {"btc": btc, "eth": eth, "sol": sol}


def get_market_prices(market):
    """Market outcomePrices -> (yes, no)."""
    return _parse_outcome_prices(market.get("outcomePrices"))


def get_market_liquidity_usd(market):
    """Market liquidity string -> float USD."""
    liq = market.get("liquidity")
    if liq is None or liq == "":
        return 0.0
    try:
        n = float(liq)
        return max(0.0, n)
    except (TypeError, ValueError):
        return 0.0


def load_crypto_events_from_fixture(file_path=None):
    """data/gamma.json (btc, eth, sol) birleştir. Test için."""
    path = Path(file_path) if file_path else ROOT / "data" / "gamma.json"
    if not path.is_absolute():
        path = ROOT / path
    if not path.exists():
        return []
    with open(path) as f:
        raw = json.load(f)
    btc = raw.get("btc") or []
    eth = raw.get("eth") or []
    sol = raw.get("sol") or []
    return list(btc) + list(eth) + list(sol)
