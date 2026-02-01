#!/usr/bin/env python3
"""
Arbitraj pipeline: bağımlılık tespiti → Layer 1 (arbitraj var mı) → execution validation → sonuç.
Paper modda: emir gönderilmez, sadece log. Config ve .env kullanır.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.config_loader import load_env, load_yaml
from src.execution_mode import get_mode
from src.dependency_detection import (
    PROMPT_TEMPLATE,
    call_gemini,
    parse_combinations,
    is_dependent,
)
from src.optimization_layer1 import check_arbitrage
from src.execution_validation import passes_execution_validation
from src.manual_review_queue import add as queue_add
from src.position_sizing import size_from_orderbook_depth
from src.order_submission import submit_orders
from src.monitoring import record_opportunity, record_execution, record_event, get_metrics


def main():
    env = load_env()
    cfg_dep = load_yaml("dependency_detection")
    cfg_l3 = load_yaml("optimization_layer3")
    cfg_risk = load_yaml("risk_params")
    api_key = env.get("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        print("HATA: GOOGLE_GEMINI_API_KEY .env'de tanımlı değil.")
        sys.exit(1)

    llm = cfg_dep.get("llm") or {}
    model = env.get("GOOGLE_GEMINI_MODEL") or llm.get("model", "gemini-2.0-flash")
    min_margin = float(env.get("MIN_PROFIT_MARGIN_USD") or cfg_risk.get("min_profit_margin_usd") or cfg_l3.get("min_profit_margin_usd", 0.05))
    min_liq = float(cfg_risk.get("min_liquidity_per_leg_usd") or cfg_l3.get("min_liquidity_per_leg_usd", 100))

    market_a = "Trump 2024 seçimleri kazanacak mı?"
    conditions_a = "Evet / Hayır"
    market_b = "Cumhuriyetçi aday 2024 seçimini kazanacak mı?"
    conditions_b = "Evet / Hayır"
    n_a, n_b = 2, 2

    print("1. Bağımlılık tespiti (Gemini)...")
    prompt = PROMPT_TEMPLATE % (market_a, conditions_a, market_b, conditions_b)
    text = call_gemini(api_key, model, prompt, temperature=llm.get("temperature", 0.2), max_tokens=llm.get("max_tokens", 1024))
    combinations = parse_combinations(text)
    dep = is_dependent(combinations, n_a, n_b)
    print("   Bağımlılık var:", dep, "| Kombinasyon sayısı:", len(combinations))

    if not dep:
        print("   Bağımsız piyasalar; arbitraj (bağımlılık) yok. Bitiş.")
        print("Metrikler:", get_metrics())
        print("OK: Pipeline tamamlandı.")
        return

    print("2. Layer 1 (arbitraj var mı?)...")
    prices = {"market_a_yes": 0.48, "market_a_no": 0.52, "market_b_yes": 0.32, "market_b_no": 0.68}
    has_arb, min_cost = check_arbitrage(prices, combinations, timeout=0.1)
    print("   Arbitraj var:", has_arb, "| Min maliyet:", round(min_cost, 4))

    if not has_arb:
        print("   Fiyatlar arbitrajsız. Bitiş.")
        print("Metrikler:", get_metrics())
        print("OK: Pipeline tamamlandı.")
        return

    profit_usd = 1.0 - min_cost
    print("3. Execution validation (min marj, likidite)...")
    passed, reason = passes_execution_validation(profit_usd, min_volume_per_leg_usd=150, min_margin_usd=min_margin, min_liquidity_usd=min_liq)
    print("   Geçti:", passed, "| Sebep:", reason)

    if passed:
        record_opportunity()
        record_event("opportunity", {"profit_usd": round(profit_usd, 4), "min_cost": round(min_cost, 4)})
        cfg_ex = load_yaml("execution")
        cap_pct = (cfg_ex.get("position_sizing") or {}).get("cap_pct_of_depth", 50)
        depth_per_leg = [150, 150]
        size_usd = size_from_orderbook_depth(depth_per_leg, cap_pct=cap_pct)
        mode_data = get_mode()
        mode = mode_data.get("EXECUTION_MODE") or env.get("EXECUTION_MODE", "paper")
        success, msg = submit_orders([], size_usd, env, cfg_ex, execution_mode=mode)
        record_execution(success, pnl_usd=profit_usd, latency_ms=0)
        record_event("execution", {"success": success, "pnl_usd": round(profit_usd, 4), "mode": mode})
        print("4. Mod:", mode, "| Pozisyon (cap %50):", round(size_usd, 2), "USD |", msg)
        qid = queue_add({
            "market_a": market_a,
            "market_b": market_b,
            "combinations": combinations,
            "dependency": True,
            "has_arbitrage": has_arb,
            "min_cost": min_cost,
            "profit_usd": profit_usd,
        })
        print("   Kuyruk id:", qid)
    print("5. Metrikler:", get_metrics())
    print("OK: Pipeline tamamlandı.")


if __name__ == "__main__":
    main()
