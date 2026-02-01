# Konsept Notu — Polymarket Arbitraj

**Referans:** article-en.md, article-tr.md, arXiv:2508.03474, arXiv:1606.02825

---

## Matematik Özeti

### Politop (Marginal polytope)

- Geçerli sonuç vektörleri **Z**; **M = conv(Z)** arbitrajsız fiyat manifoldu.
- Fiyatlar M dışındaysa arbitraj var.

### Bregman projeksiyonu

- Optimal arbitraj = mevcut fiyatları M üzerine projekte etmek (KL diverjansı, LMSR).
- **μ* = argmin_{μ ∈ M} D(μ||θ)**

### Frank-Wolfe

- M üzerinde doğrudan projeksiyon yerine iteratif LP + IP oracle (örn. Gurobi).

---

## Makale Bulguları

- Sofistike aktörler ~40M USD arbitraj kârı (1 yıl).
- En iyi tek cüzdan ~2M USD.
- Bağımlı piyasalar: geçerli kombinasyon < n×m; LLM + manuel doğrulama ile tespit.
- Execution: paralel bacak, OB %50 cap, min marj $0.05.

---

## Proje Kararları

- **LLM:** Google Gemini (REST API).
- **Layer 1:** scipy linprog (arbitraj var/yok).
- **Veri:** Polymarket WebSocket + Alchemy (Polygon, 10 blok/istek Free plan).
