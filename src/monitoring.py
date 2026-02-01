"""İzleme: metrikler (fırsat, execution, PnL, drawdown) — data/metrics.json, data/metrics_history.json."""
import json
import time
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

METRICS_PATH = ROOT / "data" / "metrics.json"
HISTORY_PATH = ROOT / "data" / "metrics_history.json"
EVENT_HISTORY_PATH = ROOT / "data" / "event_history.json"
MAX_TIMESTAMPS = 120
MAX_HISTORY = 500
MAX_EVENT_HISTORY = 100


def _load():
    if not METRICS_PATH.exists():
        return {"opportunities_count": 0, "executions_count": 0, "executions_success": 0, "total_pnl": 0.0, "peak_pnl": 0.0, "avg_latency_ms": 0.0, "updated_at": None, "opportunity_timestamps": [], "execution_timestamps": []}
    try:
        with open(METRICS_PATH) as f:
            m = json.load(f)
        if "opportunity_timestamps" not in m:
            m["opportunity_timestamps"] = []
        if "execution_timestamps" not in m:
            m["execution_timestamps"] = []
        return m
    except Exception:
        return {"opportunities_count": 0, "executions_count": 0, "executions_success": 0, "total_pnl": 0.0, "peak_pnl": 0.0, "avg_latency_ms": 0.0, "updated_at": None, "opportunity_timestamps": [], "execution_timestamps": []}


def _save(m):
    METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    m["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with open(METRICS_PATH, "w") as f:
        json.dump(m, f, indent=2)
    # Snapshot for charts
    peak = m.get("peak_pnl", 0) or 1
    drawdown_pct = ((peak - m.get("total_pnl", 0)) / peak * 100) if peak > 0 else 0
    snap = {"ts": m["updated_at"], "opportunities_count": m.get("opportunities_count", 0), "executions_count": m.get("executions_count", 0), "total_pnl": m.get("total_pnl", 0), "drawdown_pct": round(drawdown_pct, 2), "avg_latency_ms": round(m.get("avg_latency_ms", 0), 2)}
    _append_history(snap)


def _append_history(snap):
    try:
        history = []
        if HISTORY_PATH.exists():
            with open(HISTORY_PATH) as f:
                history = json.load(f)
        history.append(snap)
        if len(history) > MAX_HISTORY:
            history = history[-MAX_HISTORY:]
        with open(HISTORY_PATH, "w") as f:
            json.dump(history, f, indent=0)
    except Exception:
        pass


def record_event(event_type, detail=None):
    """Olay geçmişine ekler (fırsat/execution bilgilendirme). event_type: 'opportunity'|'execution', detail: dict."""
    try:
        EVENT_HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        events = []
        if EVENT_HISTORY_PATH.exists():
            with open(EVENT_HISTORY_PATH) as f:
                events = json.load(f)
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        events.append({"ts": ts, "type": event_type, "detail": detail or {}})
        if len(events) > MAX_EVENT_HISTORY:
            events = events[-MAX_EVENT_HISTORY:]
        with open(EVENT_HISTORY_PATH, "w") as f:
            json.dump(events, f, indent=0, ensure_ascii=False)
    except Exception:
        pass


def get_event_history(limit=50):
    """Son N olayı döner (yeniden eskiye)."""
    if not EVENT_HISTORY_PATH.exists():
        return []
    try:
        with open(EVENT_HISTORY_PATH) as f:
            events = json.load(f)
        return (events[-limit:] if isinstance(events, list) else [])[::-1]
    except Exception:
        return []


def record_opportunity():
    """Bir fırsat tespit edildi."""
    m = _load()
    m["opportunities_count"] = m.get("opportunities_count", 0) + 1
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    m["opportunity_timestamps"] = (m.get("opportunity_timestamps") or [])[-MAX_TIMESTAMPS:] + [ts]
    _save(m)


def record_execution(success, pnl_usd=0.0, latency_ms=0.0):
    """Bir execution (paper veya live) kaydedildi."""
    m = _load()
    m["executions_count"] = m.get("executions_count", 0) + 1
    if success:
        m["executions_success"] = m.get("executions_success", 0) + 1
    m["total_pnl"] = m.get("total_pnl", 0) + float(pnl_usd)
    m["peak_pnl"] = max(m.get("peak_pnl", 0), m["total_pnl"])
    n = m["executions_count"]
    old_avg = m.get("avg_latency_ms", 0) * (n - 1) if n > 1 else 0
    m["avg_latency_ms"] = (old_avg + latency_ms) / n if n else 0
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    m["execution_timestamps"] = (m.get("execution_timestamps") or [])[-MAX_TIMESTAMPS:] + [ts]
    _save(m)


def _count_last_minute(timestamps):
    """Son 60 saniyedeki ISO timestamp sayısı."""
    if not timestamps:
        return 0
    try:
        from datetime import datetime, timezone
        cutoff = datetime.now(timezone.utc).timestamp() - 60
        return sum(1 for t in timestamps if datetime.fromisoformat(t.replace("Z", "+00:00")).timestamp() > cutoff)
    except Exception:
        return 0


def get_metrics(config=None):
    """Güncel metrikleri döner; config verilmezse config/monitoring.yaml yüklenir, alert kontrolü yapılır."""
    m = _load()
    ec = m.get("executions_count", 0)
    es = m.get("executions_success", 0)
    m["execution_success_rate"] = (es / ec * 100) if ec else 0
    peak = m.get("peak_pnl", 0) or 1
    m["drawdown_pct"] = ((peak - m.get("total_pnl", 0)) / peak * 100) if peak > 0 else 0
    m["opportunities_per_min"] = _count_last_minute(m.get("opportunity_timestamps") or [])
    m["executions_per_min"] = _count_last_minute(m.get("execution_timestamps") or [])
    if config is None:
        try:
            from src.config_loader import load_yaml
            config = load_yaml("monitoring")
        except Exception:
            config = {}
    try:
        from src.alerts import check_alerts
        m["alerts"] = check_alerts(m, config)
    except Exception:
        m["alerts"] = []
    return m


def get_metrics_history(limit=200):
    """Son N snapshot'ı döner (grafik için)."""
    if not HISTORY_PATH.exists():
        return []
    try:
        with open(HISTORY_PATH) as f:
            h = json.load(f)
        return h[-limit:] if isinstance(h, list) else []
    except Exception:
        return []
