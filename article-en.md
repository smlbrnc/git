# The Math Needed for Trading on Polymarket (Complete Roadmap)

**Roan** · [@RohOnChain](https://x.com/RohOnChain) · 30 Jan

I'm going to break down the essential math you need for trading on Polymarket. I'll also share the exact roadmap and resources that helped me personally.

---

## Introduction

A recent research paper just exposed the reality. Sophisticated traders extracted **$40 million** in guaranteed arbitrage profits from Polymarket in one year. The top trader alone made **$2,009,631.76**. These aren't lucky gamblers. They're running Bregman projections, Frank-Wolfe algorithms, and solving optimization problems that would make most computer science PhDs uncomfortable.

> **Bookmark This** — I'm Roan, a backend developer working on system design, HFT-style execution, and quantitative trading systems. My work focuses on how prediction markets actually behave under load.

When you see a market where YES is $0.62 and NO is $0.33, you think "that adds up to $0.95, there's arbitrage." You're right. What most people never realize is that while they're manually checking whether YES plus NO equals $1, quantitative systems are solving integer programs that scan **17,218 conditions** across **2^63 possible outcomes** in milliseconds. By the time a human places both orders, the spread is gone. The systems have already found the same violation across dozens of correlated markets, calculated optimal position sizes accounting for order book depth and fees, executed parallel non-atomic trades, and rotated capital into the next opportunity.

**The difference isn't just speed. It's mathematical infrastructure.**

By the end of this article, you will understand the exact optimization frameworks that extracted $40 million from Polymarket. You'll know why simple addition fails, how integer programming compresses exponential search spaces, and what Bregman divergence actually means for pricing efficiency. More importantly, you'll see the specific code patterns and algorithmic strategies that separate hobby projects from production systems running millions in capital.

> **Note:** This isn't a skim. If you're serious about building systems that can scale to seven figures, read it end to end. If you're here for quick wins or vibe coding, this isn't for you.

---

## Part I: The Marginal Polytope Problem (Why Simple Math Fails)

### The Reality of Multi-Condition Markets

**Single condition market:** "Will Trump win Pennsylvania?"

|       | Price  |
|-------|--------|
| YES   | $0.48  |
| NO    | $0.52  |
| **Sum** | **$1.00** |

Looks perfect. No arbitrage, right? **Wrong.**

Now add another market: "Will Republicans win Pennsylvania by 5+ points?"

|       | Price  |
|-------|--------|
| YES   | $0.32  |
| NO    | $0.68  |

Still both sum to $1. Still looks fine. But there's a **logical dependency**: If Republicans win by 5+ points, Trump must win Pennsylvania. These markets aren't independent — and that creates arbitrage.

### The Mathematical Framework

For any market with *n* conditions, there are **2^n** possible price combinations. But only **n** valid outcomes because exactly one condition must resolve to TRUE.

Define the set of valid payoff vectors:

```
Z = { φ(ω) : ω ∈ Ω }
```

Where φ(ω) is a binary vector showing which condition is TRUE in outcome ω.

The **marginal polytope** is the convex hull of these valid vectors:

```
M = conv(Z)
```

Arbitrage-free prices must lie in **M**. Anything outside M is exploitable.

**Pennsylvania example:**

- Market A: 2 conditions → 2 valid outcomes  
- Market B: 2 conditions → 2 valid outcomes  
- Combined naive check: 2 × 2 = **4** possible outcomes  
- **Actual valid outcomes: 3** (dependency eliminates one)

When prices assume 4 independent outcomes but only 3 exist, the mispricing creates guaranteed profit.

### Why Brute Force Dies

NCAA 2010 tournament market had:

- 63 games (win/loss each)
- **2^63 = 9,223,372,036,854,775,808** possible outcomes
- 5,000+ securities

Checking every combination is computationally impossible. The research paper found **1,576** potentially dependent market pairs in the 2024 US election alone. Naive pairwise verification would require checking 2^(n+m) combinations for each pair. At just 10 conditions per market, that's **2^20 = 1,048,576** checks per pair. Multiply by 1,576 pairs. Your laptop will still be computing when the election results are already known.

### The Integer Programming Solution

Instead of enumerating outcomes, describe the valid set with **linear constraints**:

```
Z = { z ∈ {0,1}^I : A^T × z ≥ b }
```

**Real example from Duke vs Cornell market:**

- Each team has 7 securities (0 to 6 wins). That's 14 conditions → **2^14 = 16,384** combinations.
- But they can't both win 5+ games because they'd meet in the semifinals.

**Integer programming constraints:**

- `sum(z_duke, 0..6) = 1`
- `sum(z_cornell, 0..6) = 1`
- `z(duke,5) + z(duke,6) + z(cornell,5) + z(cornell,6) ≤ 1`

Three linear constraints replace 16,384 brute force checks. This is how quantitative systems handle exponential complexity: they don't enumerate, they **constrain**.

### Detection Results from Real Data

The research team analyzed markets from April 2024 to April 2025:

| Metric | Value |
|--------|--------|
| Total conditions examined | 17,218 |
| Conditions showing single-market arbitrage | 7,051 (41%) |
| Median mispricing | $0.60 per $1.00 (should be $1.00) |
| Dependent market pairs with exploitable arbitrage | 13 |

Median $0.60 means markets were regularly wrong by **40%**. Not close to efficient. Massively exploitable.

> **Key takeaway:** Arbitrage detection isn't about checking if numbers add up. It's about solving constraint satisfaction problems over exponentially large outcome spaces using compact linear representations.

---

## Part II: Bregman Projection (How to Actually Remove Arbitrage)

Finding arbitrage is one problem. Calculating the optimal exploiting trade is another.

You can't just "fix" prices by averaging or nudging numbers. You need to **project** the current market state onto the arbitrage-free manifold while preserving the information structure.

### Why Standard Distance Fails

Euclidean projection would minimize:

```
||μ - θ||²
```

This treats all price movements equally. But markets use **cost functions**. A price move from $0.50 to $0.60 has different information content than a move from $0.05 to $0.15, even though both are 10 cent changes. Market makers use **logarithmic cost functions (LMSR)** where prices represent implied probabilities. The right distance metric must respect this structure.

### The Bregman Divergence

For any convex function *R* with gradient ∇*R*, the Bregman divergence is:

```
D(μ||θ) = R(μ) + C(θ) - θ·μ
```

- **R(μ):** convex conjugate of the cost function C  
- **θ:** current market state  
- **μ:** target price vector  
- **C(θ):** market maker's cost function  

For LMSR, *R*(μ) is **negative entropy**:

```
R(μ) = Σ μᵢ ln(μᵢ)
```

This makes *D*(μ||θ) the **Kullback-Leibler divergence**, measuring information-theoretic distance between probability distributions.

### The Arbitrage Profit Formula

The maximum guaranteed profit from any trade equals:

```
max_δ [ min_ω ( δ·φ(ω) - C(θ+δ) + C(θ) ) ] = D(μ*||θ)
```

Where **μ*** is the **Bregman projection** of θ onto *M*. The proof requires convex duality theory; the implication is clear: finding the optimal arbitrage trade is equivalent to computing the Bregman projection.

**Real numbers:** The top arbitrageur extracted **$2,009,631.76** over one year. Their strategy was solving this optimization faster and more accurately than everyone else:

```
μ* = argmin_{μ ∈ M} D(μ||θ)
```

Every profitable trade was finding **μ*** before prices moved.

### Why This Matters for Execution

When you detect arbitrage, you need to know:

1. **What positions** (which conditions to buy/sell)
2. **What size** (accounting for order book depth)
3. **What profit to expect** (accounting for execution risk)

Bregman projection gives you all three: **μ*** is the arbitrage-free price vector, **D(μ*||θ)** is the maximum extractable profit, **∇D** gives the trading direction. Without this framework you're guessing; with it you're optimizing.

> **Key takeaway:** Arbitrage isn't about spotting mispriced assets. It's about solving constrained convex optimization problems in spaces defined by market microstructure. The math determines profitability.

---

## Part III: The Frank-Wolfe Algorithm (Making It Computationally Tractable)

Computing the Bregman projection directly is intractable. The marginal polytope *M* has exponentially many vertices. Standard convex optimization requires access to the full constraint set; for prediction markets that means enumerating every valid outcome — impossible at scale.

**Frank-Wolfe** reduces projection to a sequence of **linear programs**.

### The Core Insight

Instead of optimizing over all of *M* at once, Frank-Wolfe builds it iteratively.

**Algorithm:**

1. Start with a small set of known vertices **Z₀**
2. For iteration *t*:
   - **a.** Solve convex optimization over conv(Z_{t-1}):  
     `μ_t = argmin_{μ ∈ conv(Z_{t-1})} F(μ)`
   - **b.** Find new descent vertex by solving IP:  
     `z_t = argmin_{z ∈ Z} ∇F(μ_t)·z`
   - **c.** Add to active set: **Z_t = Z_{t-1} ∪ {z_t}**
   - **d.** Compute convergence gap:  
     `g(μ_t) = ∇F(μ_t)·(μ_t - z_t)`
   - **e.** Stop if g(μ_t) ≤ ε

The active set **Z_t** grows by one vertex per iteration. Even after 100 iterations you're only tracking 100 vertices instead of 2^63.

### The Integer Programming Oracle

The expensive part is **step 2b**. Each iteration requires solving:

```
min_{z ∈ Z} c·z   ,   c = ∇F(μ_t)
```

*c* is the current gradient, *Z* is the set of valid payoff vectors defined by integer constraints. This is an **integer linear program** — NP-hard in general, but solvers like Gurobi handle well-structured problems efficiently.

The research team used **Gurobi 5.5**. Typical solve times:

| Phase | Time |
|--------|--------|
| Early iterations (small partial outcomes) | < 1 sec |
| Mid-tournament (30–40 games settled) | 10–30 sec |
| Late tournament (50+ games settled) | < 5 sec |

Why faster later? As outcomes settle, the feasible set shrinks — fewer variables, tighter constraints.

### The Controlled Growth Problem

Standard Frank-Wolfe assumes ∇*F* is Lipschitz continuous with bounded constant. For LMSR, **∇R(μ) = ln(μ) + 1**. As μ → 0 the gradient explodes to −∞; standard convergence proofs break.

The solution is **Barrier Frank-Wolfe**: optimize over a **contracted polytope** instead of *M*:

```
M' = (1-ε)M + εu
```

*u* is an interior point with all coordinates in (0,1), ε ∈ (0,1) is the contraction parameter. For any ε > 0 the gradient is bounded on *M'*; Lipschitz constant is O(1/ε). The algorithm adaptively decreases ε as iterations progress so ε → 0 asymptotically and the contracted problem converges to the true projection.

### Convergence Rate

Frank-Wolfe converges at rate **O(L × diam(M) / t)** where *L* is the Lipschitz constant and diam(*M*) is the diameter of *M*. With LMSR and adaptive contraction this becomes **O(1/(ε×t))**. In practice, 50 to 150 iterations were sufficient for markets with thousands of conditions.

### Production Performance

From the paper: *"Once projections become practically fast, FWMM achieves superior accuracy to LCMM."*

| Timeline | Result |
|----------|--------|
| First 16 games | LCMM and FWMM similar (IP solver too slow) |
| After 45 games settled | First successful 30-minute projection |
| Remaining tournament | FWMM outperforms LCMM by 38% median improvement |

The crossover is when the outcome space shrinks enough for IP solves to complete within trading timeframes.

> **Key takeaway:** Theoretical elegance means nothing without computational tractability. Frank-Wolfe with integer programming oracles makes Bregman projection practical on markets with trillions of outcomes. This is how $40 million in arbitrage was actually computed and executed.

---

## Part IV: Execution Under Non-Atomic Constraints (Why Order Books Change Everything)

You've detected arbitrage. You've computed the optimal trade via Bregman projection. Now you need to **execute** — and this is where most strategies fail.

### The Non-Atomic Problem

Polymarket uses a **Central Limit Order Book (CLOB)**. Unlike DEXs where arbitrage can be atomic (all trades succeed or all fail), CLOB execution is **sequential**.

**Plan:** Buy YES at $0.30, Buy NO at $0.30 → Total cost $0.60, guaranteed payout $1.00 → Expected profit $0.40.

**Reality:**

- Submit YES order → Fills at $0.30 ✓  
- Price updates due to your order  
- Submit NO order → Fills at $0.78 ✗  
- Total cost $1.08, payout $1.00 → **Actual result: -$0.08 loss**

One leg fills, the other doesn't; you're exposed. That's why the research only counted opportunities with at least **$0.05** profit margin. Smaller edges get eaten by execution risk.

### Volume-Weighted Average Price (VWAP) Analysis

Instead of assuming instant fills at quoted prices, calculate **expected execution price**:

```
VWAP = Σ(price_i × volume_i) / Σ(volume_i)
```

Research methodology: For each block on Polygon (~2 sec), compute VWAP_yes and VWAP_no from trades in that block. If **|VWAP_yes + VWAP_no − 1.0| > 0.02**, record arbitrage opportunity; profit = that deviation. The atomic time unit is the **block**; per-block VWAP captures achievable prices, not instant execution fantasy.

### The Liquidity Constraint

Even if prices are mispriced, you can only capture profit up to **available liquidity**. Example: Market shows arbitrage (sum of YES = $0.85), potential profit $0.15 per dollar; order book depth at those prices = $234. Maximum extractable profit: **234 × 0.15 = $35.10**. The research defined max profit per opportunity as:

```
profit = (price deviation) × min(volume across all required positions)
```

For multi-condition markets you need liquidity in **all** positions simultaneously; the **minimum** caps your profit.

### Time Window Analysis

The research used a **950-block window (~1 hour)** to group related trades. Why 1 hour? Because **75%** of matched orders on Polymarket fill within that timeframe. For each trader address, all bids within a 950-block window were grouped as a single strategy execution; profit = guaranteed minimum payout across outcomes minus total cost.

### Execution Success Rates

| Category | Detection | Execution |
|----------|-----------|-----------|
| Single condition arbitrage | 7,051 conditions, most exploited | 41% of conditions had opportunities |
| Market rebalancing | 42% of multi-condition markets | — |
| Combinatorial arbitrage | 13 valid pairs | 5 showed execution |

The gap between detection and execution is **execution risk**.

### Latency Layers: The Speed Hierarchy

| Layer | Retail | Sophisticated system |
|--------|--------|----------------------|
| Polymarket API / WebSocket | ~50 ms | <5 ms (push) |
| Matching / Decision | ~100 ms | <10 ms (pre-computed) |
| RPC / Parallel execution | — | ~15 ms + ~10 ms |
| Polygon block / propagation | ~2,000 ms / ~500 ms | ~2,000 ms |
| **Total** | **~2,650 ms** | **~2,040 ms** |

The 20–30 ms you see on-chain is decision-to-mempool time. Fast wallets submit all legs within 30 ms and get everything confirmed in the same block, eliminating sequential execution risk. When you copy at Block N+1 you're **4 seconds** behind a sub-second opportunity.

### Why Copytrading Fast Wallets Fails

- **Block N-1:** Fast system detects mispricing, submits 4 tx in 30 ms.  
- **Block N:** All confirm, arbitrage captured; you see this.  
- **Block N+1:** You copy their trade, but price is now $0.78 (was $0.30).  

You're not arbitraging; you're **providing exit liquidity**. Order book depth hurts you: fast wallet buys 50,000 tokens (VWAP $0.322). Market moves. You buy 5,000 later (VWAP $0.344). They paid $0.322, you paid $0.344 — their 10 cent edge becomes your 2.2 cent loss.

### The Capital Efficiency Problem

Top arbitrageur operated with **$500K+** capital. With $5K the same strategy breaks: slippage eats a larger share of smaller positions; you can't diversify across enough opportunities; one failed execution wipes out days of profit; fixed costs (gas) eat margin. Gas on a 4-leg strategy ~$0.02. $0.08 profit → 25% to gas; $0.03 profit → 67% to gas — hence the $0.05 minimum threshold.

### Real Execution Data

**Single condition:** Detected 7,051, 87% execution success. Failures: liquidity 48%, price movement 31%, competition 21%.

**Combinatorial:** 13 pairs detected, 45% execution. Failures: insufficient simultaneous liquidity 71%, speed competition 18%.

> **Key takeaway:** Mathematical correctness is necessary but not sufficient. Execution speed, order book depth, and non-atomic fill risk determine actual profitability. The $40 million was extracted because sophisticated actors solved execution problems, not just math problems.

---

## Part V: The Complete System (What Actually Got Deployed)

Theory is clean. Production is messy. Here's what a working arbitrage system looks like based on the research and practical requirements.

### The Data Pipeline

**Real-time:**

- **WebSocket** to Polymarket CLOB API  
  - Order book updates (price/volume)  
  - Trade execution feed  
  - Market creation/settlement events  

**Historical:**

- **Alchemy Polygon** node API  
  - Contract `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` events  
  - OrderFilled, PositionSplit, PositionsMerge  

86 million transactions were analyzed; that volume requires **infrastructure**, not scripts.

### The Dependency Detection Layer

For 305 US election markets there are **46,360** possible pairs. Manual analysis is impossible. The research used **DeepSeek-R1-Distill-Qwen-32B** with prompt engineering:

- **Input:** Two markets + condition descriptions  
- **Output:** JSON of valid outcome combinations  

Validation: (1) Exactly one TRUE condition per outcome per market? (2) Fewer valid combinations than n×m (dependency)? (3) Do dependent subsets satisfy arbitrage conditions?

**Election markets results:**

- 40,057 independent pairs  
- 1,576 dependent pairs  
- 374 satisfied strict combinatorial conditions  
- 13 manually verified exploitable  

**81.45%** accuracy on complex multi-condition markets — good enough for filtering; manual verification required for execution.

### The Optimization Engine

**Three-layer arbitrage removal:**

1. **Layer 1 — Simple LCMM constraints**  
   Fast LP relaxations: "probabilities sum to 1", "if A ⇒ B then P(A) ≤ P(B)", etc. Milliseconds; removes obvious mispricing.

2. **Layer 2 — Integer programming projection**  
   Frank-Wolfe + Gurobi IP. Parameters: Alpha=0.9, initial epsilon=0.1, convergence 1e-6, time limit 30 min (reduced as markets shrink). Typical 50–150 iterations; 1–30 sec per iteration depending on size.

3. **Layer 3 — Execution validation**  
   Before submitting, simulate fills against current order book: sufficient liquidity? expected slippage? guaranteed profit after slippage? above minimum ($0.05)? Execute only if all pass.

### Position Sizing

**Modified Kelly** with execution risk:

```
f = (b×p - q) / b × √p
```

*b* = arbitrage profit %, *p* = probability of full execution (from order book depth), *q = 1−p*. Cap at **50%** of order book depth to avoid moving the market.

### The Monitoring Dashboard

Real-time: opportunities detected/executed per minute, execution success rate, total profit, drawdown, average latency. Alerts: drawdown >15%, execution rate <30%, IP timeouts up, fill failures spike. Top arbitrageur made **4,049** transactions — ~11 trades per day over one year; not traditional HFT but systematic and consistent.

### The Actual Results (April 2024 – April 2025)

| Category | Amount |
|----------|--------|
| Single condition — buy both <$1 | $5,899,287 |
| Single condition — sell both >$1 | $4,682,075 |
| **Single condition total** | **$10,581,362** |
| Rebalancing — buy all YES <$1 | $11,092,286 |
| Rebalancing — sell all YES >$1 | $612,189 |
| Rebalancing — buy all NO | $17,307,114 |
| **Rebalancing total** | **$29,011,589** |
| Combinatorial (cross-market) | $95,634 |
| **Grand total** | **$39,688,585** |

- Top 10: **$8,127,849** (20.5%)  
- Top single extractor: **$2,009,632** (4,049 trades)  
- Average profit per trade (top): **$496**  

Not lottery wins. Not lucky timing. **Mathematical precision**, executed systematically.

### What Separates Winners from Losers

**Retail:** Check prices every 30 sec, see if YES+NO ≈ $1, maybe a spreadsheet, manual orders, hope for the best.

**Quantitative:** Real-time WebSocket, integer programming for dependencies, Frank-Wolfe + Bregman for optimal trades, parallel execution with VWAP estimation, systematic position sizing under execution constraints. 2.65 s latency vs 30 s polling. One group extracted $40 million; the other provided the liquidity.

> **Key takeaway:** Production systems require mathematical rigor **and** engineering sophistication — optimization theory, distributed systems, real-time data, risk management, execution algorithms. The math is the foundation; the infrastructure is what makes it profitable.

---

## The Final Reality

While traders were reading "10 tips for prediction markets," quantitative systems were:

- Solving integer programs to detect dependencies across 17,218 conditions  
- Computing Bregman projections to find optimal arbitrage trades  
- Running Frank-Wolfe with controlled gradient growth  
- Executing parallel orders with VWAP-based slippage estimation  
- Systematically extracting **$40 million** in guaranteed profits  

The difference is not luck. It's **mathematical infrastructure**.

The research paper is public. The algorithms are known. The profits are real. The question is: **can you build it before the next $40 million is extracted?**

---

## Resources

| Resource | Description |
|----------|-------------|
| Research paper | [Unravelling the Probabilistic Forest: Arbitrage in Prediction Markets](https://arxiv.org/abs/2508.03474) (arXiv:2508.03474v1) |
| Theory foundation | [Arbitrage-Free Combinatorial Market Making via Integer Programming](https://arxiv.org/abs/1606.02825) (arXiv:1606.02825v2) |
| IP solver | Gurobi Optimizer |
| LLM (dependencies) | DeepSeek-R1-Distill-Qwen-32B |
| Data | Alchemy Polygon node API |

The math works. The infrastructure exists. The only question is **execution.**

---

*Let me know below if you want Part 2 on this?*
