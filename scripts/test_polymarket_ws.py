#!/usr/bin/env python3
"""
Polymarket CLOB WebSocket bağlantı testi.
Bağlanır, MARKET kanalına bir asset_id ile abone olur, ~30 sn mesaj bekler, kapanır.
.env: POLYMARKET_WS_URL (örn. wss://ws-subscriptions-clob.polymarket.com/ws/market)
"""
import json
import os
import sys
import time
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
        import websocket
    except ImportError:
        print("HATA: websocket-client kurulu değil. pip install websocket-client")
        sys.exit(1)

    env = load_env()
    url = env.get("POLYMARKET_WS_URL", "wss://ws-subscriptions-clob.polymarket.com/ws/market")
    # Dokümantasyondan örnek asset_id (tek piyasa için yeterli)
    sample_asset_id = "109681959945973300464568698402968596289258214226684818748321941747028805721376"

    received = []

    def on_message(ws, message):
        received.append(message)
        try:
            data = json.loads(message) if isinstance(message, str) else message
            print("MSG:", json.dumps(data)[:200] + ("..." if len(str(data)) > 200 else ""))
        except Exception:
            print("MSG:", str(message)[:200])

    def on_error(ws, error):
        print("WS HATA:", error)

    def on_close(ws, close_status_code, close_msg):
        print("WS KAPANDI:", close_status_code, close_msg)

    def on_open(ws):
        ws.send(json.dumps({"assets_ids": [sample_asset_id], "type": "market"}))
        print("Abone olundu:", sample_asset_id[:20] + "...")
        # 30 sn sonra kapat
        import threading
        def close_later():
            time.sleep(30)
            app.close()
        threading.Thread(target=close_later, daemon=True).start()

    app = websocket.WebSocketApp(
        url,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        on_open=on_open,
    )

    print("Bağlanıyor:", url)
    print("~30 sn mesaj bekleniyor...")
    app.run_forever()
    print("Toplam mesaj:", len(received))
    print("OK: WebSocket bağlantı testi tamamlandı.")

if __name__ == "__main__":
    main()
