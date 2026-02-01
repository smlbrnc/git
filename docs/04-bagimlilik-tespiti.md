# Bağımlılık Tespiti — Yaklaşım ve Doğruluk

**İlişkili:** config/dependency_detection.yaml, src/dependency_detection.py, data/manual_review_queue.json

---

## Yaklaşım

- **LLM:** İki piyasa + koşul açıklamaları → geçerli sonuç kombinasyonları (JSON array).
- **Validasyon:** Her piyasada tam 1 TRUE; kombinasyon sayısı < n×m ise bağımlılık.
- **Manuel kuyruk:** Şüpheli/kompleks çiftler için onay/red (dashboard).

---

## Prompt Şablonu

- Girdi: Piyasa A (başlık, koşullar), Piyasa B (başlık, koşullar).
- Çıktı: `[{"market_a_outcome": "X", "market_b_outcome": "Y"}, ...]` — sadece JSON.

---

## Doğruluk Hedefi

- Karmaşık çok koşullu piyasalar için **≥ %80** doğru kombinasyon seti.
- Örnek 5–10 çift için manuel doğrulama; hata oranı loglanır.

---

## Config

- **config/dependency_detection.yaml:** provider (gemini), model, temperature, max_tokens, manual_review_queue path.
