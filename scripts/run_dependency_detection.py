#!/usr/bin/env python3
"""
Bağımlılık tespiti demo: 1 piyasa çifti → Gemini → geçerli kombinasyonlar → bağımlılık kontrolü.
Config: config/dependency_detection.yaml, .env: GOOGLE_GEMINI_API_KEY
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.config_loader import load_env, load_yaml
from src.dependency_detection import (
    PROMPT_TEMPLATE,
    call_gemini,
    parse_combinations,
    is_dependent,
)


def main():
    env = load_env()
    cfg = load_yaml("dependency_detection")
    api_key = env.get("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        print("HATA: GOOGLE_GEMINI_API_KEY .env'de tanımlı değil.")
        sys.exit(1)

    llm = cfg.get("llm") or {}
    model = env.get("GOOGLE_GEMINI_MODEL") or llm.get("model", "gemini-2.0-flash")
    temperature = llm.get("temperature", 0.2)
    max_tokens = llm.get("max_tokens", 1024)

    market_a = "Trump 2024 seçimleri kazanacak mı?"
    conditions_a = "Evet / Hayır"
    market_b = "Cumhuriyetçi aday 2024 seçimini kazanacak mı?"
    conditions_b = "Evet / Hayır"
    n_a, n_b = 2, 2

    prompt = PROMPT_TEMPLATE % (market_a, conditions_a, market_b, conditions_b)
    print("Model:", model)
    print("Piyasa A:", market_a[:50], "...")
    print("Piyasa B:", market_b[:50], "...")

    text = call_gemini(api_key, model, prompt, temperature=temperature, max_tokens=max_tokens)
    print("Yanıt (kısaltılmış):", text[:400] + ("..." if len(text) > 400 else ""))

    combinations = parse_combinations(text)
    print("Geçerli kombinasyon sayısı:", len(combinations))
    dep = is_dependent(combinations, n_a, n_b)
    print("Bağımlılık var (kombinasyon < n_a*n_b):", dep)
    print("OK: Bağımlılık tespiti tamamlandı.")


if __name__ == "__main__":
    main()
