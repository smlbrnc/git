# Config ve .env yükleme; Vercel'de os.environ öncelikli.
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"


def load_env():
    """ .env dosyasını oku; Vercel/ortam değişkenleri üzerine yazar. """
    env = {}
    env_path = ROOT / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    env.update(os.environ)
    return env


def load_yaml(name: str):
    """ config/<name>.yaml dosyasını yükler. """
    import yaml
    path = CONFIG_DIR / f"{name}.yaml"
    if not path.exists():
        return {}
    with open(path) as f:
        return yaml.safe_load(f) or {}


def save_risk_params(data: dict):
    """ config/risk_params.yaml günceller. """
    import yaml
    path = CONFIG_DIR / "risk_params.yaml"
    with open(path, "w") as f:
        yaml.safe_dump(data, f, default_flow_style=False, allow_unicode=True)


def save_monitoring_alerts(data: dict):
    """ config/monitoring.yaml içindeki alerts bölümünü günceller. """
    import yaml
    path = CONFIG_DIR / "monitoring.yaml"
    cfg = load_yaml("monitoring") if path.exists() else {}
    alerts = dict(cfg.get("alerts") or {})
    alerts.update(data)
    cfg["alerts"] = alerts
    with open(path, "w") as f:
        yaml.safe_dump(cfg, f, default_flow_style=False, allow_unicode=True)
