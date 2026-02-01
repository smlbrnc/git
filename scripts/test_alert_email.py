#!/usr/bin/env python3
"""Alert + Resend e-posta testi. Eşik aşan metriklerle uyarı üretilir, Resend ile e-posta gönderilir."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.config_loader import load_env, load_yaml
from src.alerts import check_alerts
from src.alert_email import send_alert_email

def main():
    env = load_env()
    api_key = (env.get("RESEND_API_KEY") or "").strip()
    from_email = (env.get("RESEND_FROM") or "").strip()
    to_email = (env.get("RESEND_TO") or "").strip()

    print("RESEND .env kontrolü:")
    print("  RESEND_API_KEY:", "***" if api_key else "(boş)")
    print("  RESEND_FROM:", from_email or "(boş)")
    print("  RESEND_TO:", to_email or "(boş)")

    config = load_yaml("monitoring")
    metrics = {
        "drawdown_pct": 20.0,
        "execution_success_rate": 25.0,
        "executions_count": 5,
    }
    print("\nTest metrikleri (eşik aşan):", metrics)
    messages = check_alerts(metrics, config)
    print("Tetiklenen uyarılar:", len(messages))
    for m in messages:
        print(" -", m)

    if not messages:
        print("\nUyarı tetiklenmedi.")
        return

    print("\nResend ile e-posta gönderiliyor...")
    ok, detail = send_alert_email(messages, env)
    if ok:
        print("OK: E-posta gönderildi. Yanıt:", detail)
        print("RESEND_TO adresini ve spam klasörünü kontrol et.")
    else:
        print("HATA:", detail)
        if "domain" in (detail or "").lower() or "from" in (detail or "").lower():
            print("Not: RESEND_FROM için Resend'de doğrulanmış domain gerekir.")
            print("Test için: RESEND_FROM=onboarding@resend.dev (sadece Resend hesabına kayıtlı e-postaya gider).")

if __name__ == "__main__":
    main()
