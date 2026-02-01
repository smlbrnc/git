#!/usr/bin/env python3
"""
Arbitraj pipeline: Gamma API kripto event'leri → bağımlılık tespiti → Layer 1 → execution validation → kuyruk/execution.
Sadece Bitcoin, Ethereum, Solana event'leri işlenir (SOP §4.2, §4.6.3). Polymarket Gamma API tag_id=21 (Crypto).
"""
import os
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
from src.monitoring import record_opportunity, record_execution, record_event, record_pipeline_run, get_metrics
from src.polymarket_gamma import (
    fetch_crypto_events,
    load_crypto_events_from_fixture,
    group_events_by_asset,
    get_market_prices,
    get_market_liquidity_usd,
)

CONDITIONS = "Evet / Hayır"


def normalize_outcome(s):
    if not s:
        return "Evet"
    v = str(s).strip()
    if v.lower() in ("yes", "evet"):
        return "Evet"
    if v.lower() in ("no", "hayır"):
        return "Hayır"
    return v


def normalize_combinations(combos):
    return [
        {
            "market_a_outcome": normalize_outcome(c.get("market_a_outcome")),
            "market_b_outcome": normalize_outcome(c.get("market_b_outcome")),
        }
        for c in combos
    ]


def all_binary_combinations():
    return [
        {"market_a_outcome": "Evet", "market_b_outcome": "Evet"},
        {"market_a_outcome": "Evet", "market_b_outcome": "Hayır"},
        {"market_a_outcome": "Hayır", "market_b_outcome": "Evet"},
        {"market_a_outcome": "Hayır", "market_b_outcome": "Hayır"},
    ]


def get_valid_combinations(market_a_question, market_b_question, api_key, model, llm_cfg):
    """Gemini ile geçerli kombinasyonlar; Evet/Hayır normalize."""
    if not api_key:
        return all_binary_combinations()
    prompt = PROMPT_TEMPLATE % (market_a_question, CONDITIONS, market_b_question, CONDITIONS)
    try:
        text = call_gemini(
            api_key,
            model,
            prompt,
            temperature=llm_cfg.get("temperature", 0.2),
            max_tokens=llm_cfg.get("max_tokens", 1024),
        )
        raw = parse_combinations(text)
        normalized = normalize_combinations(raw)
        valid = [c for c in normalized if c["market_a_outcome"] in ("Evet", "Hayır") and c["market_b_outcome"] in ("Evet", "Hayır")]
        if not valid:
            return all_binary_combinations()
        return valid
    except Exception:
        return all_binary_combinations()


def run_pair(event, ma, mb, env, cfg_dep, cfg_risk, cfg_l3, api_key, model, llm_cfg, min_margin, min_liq, ref_size):
    """Tek piyasa çifti: bağımlılık → Layer 1 → validation → kuyruk veya execution."""
    combinations = get_valid_combinations(ma["question"], mb["question"], api_key, model, llm_cfg)
    pa = get_market_prices(ma)
    pb = get_market_prices(mb)
    prices = {
        "market_a_yes": pa[0],
        "market_a_no": pa[1],
        "market_b_yes": pb[0],
        "market_b_no": pb[1],
    }
    has_arb, min_cost = check_arbitrage(prices, combinations, timeout=0.1)
    if not has_arb:
        return None
    record_opportunity()
    profit_per_unit = 1.0 - min_cost
    min_edge_ratio = min_margin / ref_size
    if profit_per_unit < min_edge_ratio:
        return None
    liq_a = get_market_liquidity_usd(ma)
    liq_b = get_market_liquidity_usd(mb)
    min_liq_leg = min(liq_a, liq_b) or min_liq
    size_usd = min(ref_size, min_liq_leg or ref_size, 500)
    profit_usd = profit_per_unit * size_usd
    passed, reason = passes_execution_validation(
        profit_usd,
        min_volume_per_leg_usd=min_liq_leg or min_liq,
        min_margin_usd=min_margin,
        min_liquidity_usd=min_liq,
    )
    mode_data = get_mode()
    mode = mode_data.get("EXECUTION_MODE") or env.get("EXECUTION_MODE", "paper")
    trigger = mode_data.get("TRIGGER_MODE", "manual")

    if passed and trigger == "auto":
        cfg_ex = load_yaml("execution")
        cap_pct = (cfg_ex.get("position_sizing") or {}).get("cap_pct_of_depth", 50)
        depth_per_leg = [min_liq_leg or 100, min_liq_leg or 100]
        size_usd = size_from_orderbook_depth(depth_per_leg, cap_pct=cap_pct)
        success, msg = submit_orders([], size_usd, env, cfg_ex, execution_mode=mode)
        record_execution(success, pnl_usd=profit_usd, latency_ms=0)
        record_event("execution", {"success": success, "pnl_usd": round(profit_usd, 4), "mode": mode})
        return {"executed": True, "success": success}
    else:
        qid = queue_add({
            "market_a": ma["question"],
            "market_b": mb["question"],
            "min_cost": min_cost,
            "event_slug": event.get("slug", ""),
            "market_a_id": ma.get("id", ""),
            "market_b_id": mb.get("id", ""),
            "combinations": combinations,
            "dependency": True,
            "has_arbitrage": True,
            "profit_usd": profit_usd,
        })
        return {"queued": qid}


def main():
    record_pipeline_run("running", "Kripto event'leri Gamma API (tag_id=21) ile çekiliyor.")
    env = load_env()
    cfg_dep = load_yaml("dependency_detection")
    cfg_l3 = load_yaml("optimization_layer3")
    cfg_risk = load_yaml("risk_params")
    api_key = env.get("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        record_pipeline_run("error", "GOOGLE_GEMINI_API_KEY tanımlı değil")
        print("HATA: GOOGLE_GEMINI_API_KEY .env'de tanımlı değil.")
        sys.exit(1)

    llm_cfg = cfg_dep.get("llm") or {}
    model = env.get("GOOGLE_GEMINI_MODEL") or llm_cfg.get("model", "gemini-2.0-flash")
    min_margin = float(env.get("MIN_PROFIT_MARGIN_USD") or cfg_risk.get("min_profit_margin_usd") or cfg_l3.get("min_profit_margin_usd", 0.05))
    min_liq = float(cfg_risk.get("min_liquidity_per_leg_usd") or cfg_l3.get("min_liquidity_per_leg_usd", 100))
    ref_size = float(cfg_risk.get("ref_size_usd", 100))
    limit = min(int(env.get("PIPELINE_EVENTS_LIMIT", "80")), 200)

    fixture_path = env.get("GAMMA_FIXTURE_PATH")
    if fixture_path:
        events = load_crypto_events_from_fixture(fixture_path)
        print("Fixtürden event sayısı:", len(events))
    else:
        events = fetch_crypto_events(limit)
        print("Gamma API (tag_id=21) event sayısı:", len(events))

    grouped = group_events_by_asset(events)
    crypto_only = grouped["btc"] + grouped["eth"] + grouped["sol"]
    events_with_pairs = [e for e in crypto_only if e.get("markets") and len(e["markets"]) >= 2]

    pairs_checked = 0
    arbitrage_found = 0
    queued = 0
    executed = 0

    for event in events_with_pairs:
        markets = event["markets"]
        for i in range(len(markets)):
            for j in range(i + 1, len(markets)):
                ma, mb = markets[i], markets[j]
                try:
                    result = run_pair(
                        event, ma, mb, env, cfg_dep, cfg_risk, cfg_l3,
                        api_key, model, llm_cfg, min_margin, min_liq, ref_size,
                    )
                    pairs_checked += 1
                    if result is None:
                        continue
                    arbitrage_found += 1
                    if result.get("executed"):
                        executed += 1
                    else:
                        queued += 1
                except Exception as e:
                    print("Pair hatası:", (ma.get("question") or "")[:50], str(e))

    msg = f"Gamma crypto_events={len(crypto_only)} pairs={pairs_checked} arbitrage={arbitrage_found} queued={queued} executed={executed}"
    record_pipeline_run("ok", msg)
    print("5. Metrikler:", get_metrics())
    print("OK: Pipeline tamamlandı.", msg)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        record_pipeline_run("error", str(e))
        raise
