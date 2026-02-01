"""Alert kontrolü: drawdown, execution rate eşikleri (config/monitoring.yaml). Uyarı geçmişi: data/alert_history.json."""
import json
import time
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

ALERT_HISTORY_PATH = ROOT / "data" / "alert_history.json"
MAX_ALERT_HISTORY = 200


def _append_alert_history(metric_key, threshold, message):
    try:
        ALERT_HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        history = []
        if ALERT_HISTORY_PATH.exists():
            with open(ALERT_HISTORY_PATH) as f:
                history = json.load(f)
        history.append({"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "metric": metric_key, "threshold": threshold, "message": message})
        if len(history) > MAX_ALERT_HISTORY:
            history = history[-MAX_ALERT_HISTORY:]
        with open(ALERT_HISTORY_PATH, "w") as f:
            json.dump(history, f, indent=0, ensure_ascii=False)
    except Exception:
        pass


def check_alerts(metrics, config=None):
    """
    config: monitoring.yaml içeriği (dict) veya None (varsayılan eşikler).
    Döner: list of str (uyarı mesajları). Tetiklenen uyarıları alert_history'e yazar.
    """
    if config is None:
        config = {}
    alerts_config = config.get("alerts") or {}
    out = []
    drawdown_pct = metrics.get("drawdown_pct") or 0
    drawdown_gt = alerts_config.get("drawdown_pct_gt", 15)
    if drawdown_gt and drawdown_pct > drawdown_gt:
        msg = f"Drawdown %{drawdown_pct:.1f} > %{drawdown_gt} eşiği"
        out.append(msg)
        _append_alert_history("drawdown_pct", drawdown_gt, msg)
    execution_rate = metrics.get("execution_success_rate") or 0
    rate_lt = alerts_config.get("execution_rate_lt", 30)
    if rate_lt is not None and execution_rate < rate_lt and metrics.get("executions_count", 0) > 0:
        msg = f"Execution başarı oranı %{execution_rate:.1f} < %{rate_lt} eşiği"
        out.append(msg)
        _append_alert_history("execution_rate_lt", rate_lt, msg)
    if out:
        try:
            from src.alert_email import send_alert_email
            send_alert_email(out)  # (success, detail) döner; hata sessiz kalır
        except Exception:
            pass
    return out


def get_alert_history(limit=50):
    """Son N uyarı kaydını döner."""
    if not ALERT_HISTORY_PATH.exists():
        return []
    try:
        with open(ALERT_HISTORY_PATH) as f:
            h = json.load(f)
        return (h[-limit:] if isinstance(h, list) else [])[::-1]
    except Exception:
        return []
