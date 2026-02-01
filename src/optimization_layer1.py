"""
Layer 1 (LCMM): Arbitraj var/yok kontrolü.
Verilen fiyatlar ve geçerli kombinasyonlara göre min maliyet ile her geçerli sonuçta 1$ garantileme.
Min maliyet < 1 ise arbitraj var.
"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def check_arbitrage(prices_outcomes, valid_combinations, timeout=0.1):
    """
    prices_outcomes: dict, örn. {"market_a_yes": 0.48, "market_a_no": 0.52, "market_b_yes": 0.32, "market_b_no": 0.68}
    valid_combinations: list of dict, örn. [{"market_a_outcome": "Evet", "market_b_outcome": "Evet"}, ...]
    Döner: (has_arbitrage: bool, min_cost: float).
    Basit model: her outcome için pozisyon; maliyet = sum(price * pos); her geçerli kombinasyonda payoff >= 1.
    """
    try:
        from scipy.optimize import linprog
    except ImportError:
        return False, 1.0

    # Outcome isimlerini sıralı al
    keys = list(prices_outcomes.keys())
    n = len(keys)
    prices = [float(prices_outcomes[k]) for k in keys]
    # Geçerli her kombinasyonda hangi outcome'lar TRUE: combination -> hangi indeksler 1
    # Basitleştirme: combination dict'te market_a_outcome, market_b_outcome var; keys market_a_yes, market_a_no, ...
    # Eşleme: "Evet" -> _yes, "Hayır" -> _no. keys = [market_a_yes, market_a_no, market_b_yes, market_b_no]
    # Her valid combination için: o kombinasyonda 1 olan outcome'ların indeksleri
    A_list = []
    for combo in valid_combinations:
        row = [0.0] * n
        for i, k in enumerate(keys):
            if "yes" in k.lower() and combo.get("market_a_outcome") == "Evet" and "market_a" in k.lower():
                row[i] = 1.0
            elif "no" in k.lower() and combo.get("market_a_outcome") == "Hayır" and "market_a" in k.lower():
                row[i] = 1.0
            elif "yes" in k.lower() and combo.get("market_b_outcome") == "Evet" and "market_b" in k.lower():
                row[i] = 1.0
            elif "no" in k.lower() and combo.get("market_b_outcome") == "Hayır" and "market_b" in k.lower():
                row[i] = 1.0
        A_list.append(row)
    if not A_list:
        return False, 1.0
    # min c^T x  s.t. A x >= 1 (her satır bir geçerli sonuç), x >= 0
    c = prices
    A_ub = [[-a for a in row] for row in A_list]
    b_ub = [-1.0] * len(A_list)
    res = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=(0, None), method="highs", options={"time_limit": timeout})
    if not res.success:
        return False, 1.0
    min_cost = float(res.fun)
    return min_cost < 0.999, min_cost
