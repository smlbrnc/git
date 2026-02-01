"""Polymarket WebSocket client: reconnect (exp backoff, max 5)."""
import json
import time
import threading
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def run_ws(url, asset_ids, on_message=None, run_seconds=60):
    """
    MARKET kanalına bağlanır, asset_ids ile abone olur.
    on_message(ws, message) opsiyonel. run_seconds süre çalışır.
    Reconnect: exp backoff, max 5 deneme (delay_min=1, delay_max=60).
    """
    import websocket
    received = []
    delay_min = 1
    delay_max = 60
    max_attempts = 5
    attempt = 0
    stop = threading.Event()

    def _on_message(ws, message):
        received.append(message)
        if on_message:
            on_message(ws, message)

    def _on_error(ws, error):
        pass  # reconnect'te tekrar denenecek

    def _on_close(ws, code, msg):
        pass

    def _on_open(ws):
        ws.send(json.dumps({"assets_ids": asset_ids, "type": "market"}))

    def _run():
        nonlocal attempt
        while not stop.is_set() and attempt < max_attempts:
            try:
                app = websocket.WebSocketApp(
                    url,
                    on_message=_on_message,
                    on_error=_on_error,
                    on_close=_on_close,
                    on_open=_on_open,
                )
                app.run_forever()
            except Exception:
                pass
            attempt += 1
            if not stop.is_set() and attempt < max_attempts:
                delay = min(delay_max, delay_min * (2 ** (attempt - 1)))
                time.sleep(delay)

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    time.sleep(run_seconds)
    stop.set()
    return received
