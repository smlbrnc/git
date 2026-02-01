"""Manuel doğrulama kuyruğu: data/manual_review_queue.json."""
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

QUEUE_PATH = ROOT / "data" / "manual_review_queue.json"


def _load():
    if not QUEUE_PATH.exists():
        return []
    try:
        with open(QUEUE_PATH) as f:
            return json.load(f)
    except Exception:
        return []


def _save(items):
    QUEUE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(QUEUE_PATH, "w") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)


def add(item):
    """Kuyruğa ekle. item: dict (market_a, market_b, combinations, dependency, ...)."""
    items = _load()
    item["id"] = len(items) + 1
    item["status"] = "pending"
    items.append(item)
    _save(items)
    return item["id"]


def get_all():
    """Tüm kuyruk kayıtlarını döner."""
    return _load()


def get_pending():
    """Bekleyen (status=pending) kayıtları döner."""
    return [x for x in _load() if x.get("status") == "pending"]


def approve(item_id):
    """Onayla."""
    items = _load()
    for x in items:
        if x.get("id") == item_id:
            x["status"] = "approved"
            _save(items)
            try:
                from src.audit_log import append_to_audit
                append_to_audit("queue_approve", {"id": item_id, "market_a": str(x.get("market_a", ""))[:80]})
            except Exception:
                pass
            return
    _save(items)


def reject(item_id):
    """Reddet."""
    items = _load()
    for x in items:
        if x.get("id") == item_id:
            x["status"] = "rejected"
            _save(items)
            try:
                from src.audit_log import append_to_audit
                append_to_audit("queue_reject", {"id": item_id, "market_a": str(x.get("market_a", ""))[:80]})
            except Exception:
                pass
            return
    _save(items)
