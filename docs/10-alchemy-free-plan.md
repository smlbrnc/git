# Alchemy Free Plan — Polygon Limitleri

**Plan:** Full Developer Platform (Free)  
**Kaynak:** Alchemy dokümantasyonu ve test sonuçları.

---

## Özet

| Özellik | Değer |
|--------|--------|
| Aylık kota | 30M CU/ay |
| İstek hızı | 25 req/sn |
| Uygulama / webhook | 5 app, 5 webhook |
| **Polygon eth_getLogs** | **Max 10 blok / istek** |

---

## eth_getLogs (Polygon)

- **Free plan:** Tek istekte en fazla **10 blok** aralığı.
- Daha büyük aralık istersen isteği **parçalara böl**: örn. 100 blok için 10 istek (her biri 10 blok).
- Yanıt boyutu 150 MB ile sınırlı; çok log dönerse aralığı küçült veya topic filtre kullan.

**Örnek (script):**

```python
# Doğru: 10 blok (from_block = latest - 9, to_block = latest)
from_block = latest - 9
to_block = latest
logs = w3.eth.get_logs({"address": contract, "fromBlock": from_block, "toBlock": to_block})
```

**Yanlış:** `from_block = latest - 10`, `to_block = latest` → 11 blok → Free planda 400 hatası.

---

## Compute Units (CU)

- 30M CU/ay hesap bazında.
- Her metod farklı CU tüketir; `eth_getLogs` blok aralığı ve log sayısına göre değişir.
- Rate: 500 CU/sn (uygulama bazında) — dokümantasyonda detay.

---

## Projede Kullanım

- **config/data_pipeline.yaml:** `time_window_blocks: 950` (makale referansı). Free planda 950 blok için 95 istek (950/10) gerekir; rate limit ve CU’ya dikkat.
- **scripts/test_alchemy_events.py:** 10 blokla test; Free plan uyumlu.

Referans: [Alchemy eth_getLogs](https://docs.alchemy.com/reference/eth-getlogs), [Compute Units](https://docs.alchemy.com/reference/compute-units).
