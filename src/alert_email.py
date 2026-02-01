"""Alert e-posta gönderimi — Resend API (REST veya resend paketi)."""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

RESEND_API_URL = "https://api.resend.com/emails"


def _send_via_rest(api_key, from_email, to_list, subject, html):
    """Resend REST API ile e-posta gönderir (requests kullanır)."""
    import requests
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "from": from_email,
        "to": to_list,
        "subject": subject,
        "html": html,
    }
    r = requests.post(RESEND_API_URL, json=payload, headers=headers, timeout=15)
    if r.status_code in (200, 201):
        return True, r.json()
    try:
        err = r.json()
        msg = err.get("message", err.get("name", r.text))
    except Exception:
        msg = r.text or f"HTTP {r.status_code}"
    return False, msg


def send_alert_email(messages, env=None):
    """
    Uyarı mesajlarını Resend ile e-posta olarak gönderir.
    messages: list of str (uyarı metinleri).
    env: dict (.env); verilmezse load_env() ile yüklenir.
    Döner: (True, yanıt) gönderildiyse, (False, hata_mesajı) atlandı/hata.
    """
    if not messages:
        return False, "Boş uyarı listesi"
    if env is None:
        try:
            from src.config_loader import load_env
            env = load_env()
        except Exception as e:
            return False, str(e)
    api_key = (env.get("RESEND_API_KEY") or "").strip()
    from_email = (env.get("RESEND_FROM") or "").strip()
    to_email = (env.get("RESEND_TO") or "").strip()
    if not api_key:
        return False, "RESEND_API_KEY tanımlı değil"
    if not from_email:
        return False, "RESEND_FROM tanımlı değil"
    if not to_email:
        return False, "RESEND_TO tanımlı değil"
    to_list = [e.strip() for e in to_email.split(",") if e.strip()]
    if not to_list:
        return False, "RESEND_TO geçerli adres içermiyor"
    subject = f"[Kripto İzleme] {len(messages)} uyarı"
    body = "<br>".join(f"• {m}" for m in messages) or "Uyarı tetiklendi."
    html = f"<p><strong>Uyarılar:</strong></p><p>{body}</p>"
    try:
        import resend
        resend.api_key = api_key
        out = resend.Emails.send({"from": from_email, "to": to_list, "subject": subject, "html": html})
        return True, out
    except ImportError:
        return _send_via_rest(api_key, from_email, to_list, subject, html)
    except Exception as e:
        return False, str(e)
