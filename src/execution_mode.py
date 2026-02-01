"""İşlem modu: config/execution_mode.json (panelden değiştirilir)."""
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.audit_log import append_to_audit

MODE_PATH = ROOT / "config" / "execution_mode.json"


def get_mode():
    """Döner: {"EXECUTION_MODE": "paper"|"live", "DRY_RUN": true|false}."""
    if not MODE_PATH.exists():
        return {"EXECUTION_MODE": "paper", "DRY_RUN": True}
    try:
        with open(MODE_PATH) as f:
            return json.load(f)
    except Exception:
        return {"EXECUTION_MODE": "paper", "DRY_RUN": True}


def set_mode(execution_mode, dry_run=None):
    """execution_mode: 'paper'|'live'; dry_run: True|False (opsiyonel)."""
    MODE_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = get_mode()
    data["EXECUTION_MODE"] = str(execution_mode).lower()
    if dry_run is not None:
        data["DRY_RUN"] = bool(dry_run)
    else:
        data["DRY_RUN"] = execution_mode == "paper"
    with open(MODE_PATH, "w") as f:
        json.dump(data, f, indent=2)
    append_to_audit("execution_mode_change", {"mode": data["EXECUTION_MODE"], "dry_run": data["DRY_RUN"]})
    return data
