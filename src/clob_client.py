"""
Polymarket CLOB client: emir gönderme hazırlığı.
Paper modda kullanılmaz; live modda py_clob_client ile order endpoint (şimdilik stub).
"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def get_client(env):
    """
    .env'den host, API creds; emir için PRIVATE_KEY + chain_id ile ClobClient döner.
    Eksik credential varsa None.
    """
    try:
        from py_clob_client.client import ClobClient
    except ImportError:
        return None
    host = env.get("POLYMARKET_CLOB_API_URL", "https://clob.polymarket.com")
    api_key = env.get("POLYMARKET_API_KEY")
    api_secret = env.get("POLYMARKET_API_SECRET")
    passphrase = env.get("POLYMARKET_PASSPHRASE")
    if not all([api_key, api_secret, passphrase]):
        return None
    key = env.get("PRIVATE_KEY")
    chain_id = int(env.get("POLYGON_CHAIN_ID", "137"))
    if key:
        client = ClobClient(host, key=key, chain_id=chain_id)
    else:
        client = ClobClient(host)
    client.set_api_creds({"api_key": api_key, "api_secret": api_secret, "passphrase": passphrase})
    return client


def place_order_stub(env, token_id, price, size_usd, side="BUY"):
    """
    Tek bacak emir: live modda CLOB create_and_post_order iskeleti.
    token_id, price, size_usd, side. Döner: (success: bool, message: str).
    """
    client = get_client(env)
    if client is None:
        return True, "clob_stub: no client (creds or py_clob_client missing)"
    try:
        from py_clob_client.clob_types import OrderArgs
        order_args = OrderArgs(token_id=str(token_id), price=float(price), size=float(size_usd), side=side.upper())
        _ = client.create_and_post_order(order_args)
        return True, f"clob_order_posted token={str(token_id)[:20]}... price={price} size={size_usd}"
    except Exception as e:
        return False, str(e)
