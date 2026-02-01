#!/usr/bin/env python3
"""
Google Gemini ile bağımlılık tespiti örnek çağrı (REST API, timeout ile).
İki piyasa + koşul açıklamaları verilir; LLM geçerli sonuç kombinasyonlarını JSON döner.
.env: GOOGLE_GEMINI_API_KEY
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
TIMEOUT = 30

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

PROMPT_TEMPLATE = """Aşağıda iki tahmin piyasası ve koşulları var. Geçerli sonuç kombinasyonlarını (hangi koşullar birlikte TRUE olabilir) JSON array olarak yaz.
Sadece JSON döndür, başka açıklama yazma.

Piyasa A: %s
  Koşullar: %s

Piyasa B: %s
  Koşullar: %s

Örnek çıktı formatı: [{"market_a_outcome": "X", "market_b_outcome": "Y"}, ...]
"""

def main():
    try:
        import requests
    except ImportError:
        print("HATA: requests kurulu değil. pip install requests")
        sys.exit(1)

    env = load_env()
    api_key = env.get("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        print("HATA: GOOGLE_GEMINI_API_KEY .env'de tanımlı değil.")
        sys.exit(1)

    model_name = env.get("GOOGLE_GEMINI_MODEL", "gemini-2.0-flash")
    url = GEMINI_URL.format(model=model_name)
    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}

    market_a = "Trump 2024 seçimleri kazanacak mı?"
    conditions_a = "Evet / Hayır"
    market_b = "Cumhuriyetçi aday 2024 seçimini kazanacak mı?"
    conditions_b = "Evet / Hayır"

    prompt = PROMPT_TEMPLATE % (market_a, conditions_a, market_b, conditions_b)
    print("Prompt (kısaltılmış):", prompt[:300] + "...")
    print("Çağrılıyor:", model_name, f"(timeout={TIMEOUT}s)")

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 512},
    }

    try:
        r = requests.post(url, headers=headers, json=body, timeout=TIMEOUT)
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.Timeout:
        print("HATA: İstek zaman aşımı ({} sn).".format(TIMEOUT))
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print("HATA:", e)
        if hasattr(e, "response") and e.response is not None and e.response.text:
            print("Yanıt:", e.response.text[:500])
        sys.exit(1)

    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    content = (parts[0].get("text", "") if parts else "").strip()
    print("Yanıt:", content[:500] + ("..." if len(content) > 500 else ""))

    try:
        raw = content
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        parsed = json.loads(raw)
        print("JSON parse OK, eleman sayısı:", len(parsed) if isinstance(parsed, list) else "N/A")
    except json.JSONDecodeError as e:
        print("JSON parse uyarısı:", e)
    print("OK: Gemini bağımlılık tespiti testi tamamlandı.")

if __name__ == "__main__":
    main()
