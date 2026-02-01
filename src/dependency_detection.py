"""Bağımlılık tespiti: Gemini ile geçerli kombinasyonlar, validasyon."""
import json
import re
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
TIMEOUT = 30

PROMPT_TEMPLATE = """Aşağıda iki tahmin piyasası ve koşulları var. Geçerli sonuç kombinasyonlarını (hangi koşullar birlikte TRUE olabilir) JSON array olarak yaz.
Sadece JSON döndür, başka açıklama yazma.

Piyasa A: %s
  Koşullar: %s

Piyasa B: %s
  Koşullar: %s

Örnek çıktı formatı: [{"market_a_outcome": "X", "market_b_outcome": "Y"}, ...]
"""


def call_gemini(api_key, model, prompt, temperature=0.2, max_tokens=512):
    """Gemini REST API; yanıt metnini döner."""
    import requests
    url = GEMINI_URL.format(model=model)
    r = requests.post(
        url,
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
        },
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    data = r.json()
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return (parts[0].get("text", "") if parts else "").strip()


def parse_combinations(text):
    """LLM çıktısından JSON array parse; liste döner, hata varsa []."""
    raw = (text or "").strip()
    if "```json" in raw:
        m = re.search(r"```json\s*([\s\S]*?)```", raw)
        raw = m.group(1).strip() if m else raw
    elif "```" in raw:
        m = re.search(r"```\s*([\s\S]*?)```", raw)
        raw = m.group(1).strip() if m else raw
    try:
        out = json.loads(raw)
        return out if isinstance(out, list) else []
    except json.JSONDecodeError:
        return []


def is_dependent(combinations, n_a, n_b):
    """
    Geçerli kombinasyon sayısı < n_a * n_b ise bağımlılık var.
    n_a, n_b: piyasa A/B'deki koşul (outcome) sayısı.
    """
    if not combinations:
        return True
    return len(combinations) < n_a * n_b
