"""Audit log: config/execution modu değişikliklerini logs/audit.log'a yazar."""
import json
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
AUDIT_PATH = ROOT / "logs" / "audit.log"


def append_to_audit(action: str, details=None):
    """action ve opsiyonel details'i tek satır JSON olarak ekler."""
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "ts": datetime.utcnow().isoformat() + "Z",
        "action": action,
        "details": details or {},
    }
    with open(AUDIT_PATH, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def read_audit_log(limit=200, action_filter=None):
    """Son N kaydı döner. action_filter: str veya None (tümü)."""
    if not AUDIT_PATH.exists():
        return []
    out = []
    try:
        with open(AUDIT_PATH) as f:
            lines = f.readlines()
        for line in reversed(lines[-limit * 2:]):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                if action_filter and entry.get("action") != action_filter:
                    continue
                out.append(entry)
                if len(out) >= limit:
                    break
            except Exception:
                continue
        return out[::-1]
    except Exception:
        return []
