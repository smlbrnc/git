# Resend ile Alert E-posta

Uyarılar (drawdown, execution rate eşiği aşımı) tetiklendiğinde Resend API ile e-posta gönderilir.

## Kurulum

1. **Resend hesabı:** https://resend.com — API key oluştur (https://resend.com/api-keys).
2. **.env** dosyasına ekle:
   ```bash
   RESEND_API_KEY=re_xxxx
   RESEND_FROM=Kripto Izleme <noreply@yourdomain.com>
   RESEND_TO=alert@example.com
   ```
   - `RESEND_FROM`: Resend’de doğrulanmış domain ile (örn. `noreply@yourdomain.com`). Test için `onboarding@resend.dev` kullanılabilir (sadece kayıtlı e-posta adresine gider).
   - `RESEND_TO`: Virgülle ayrılmış alıcı listesi (örn. `a@x.com,b@x.com`).

3. **Bağımlılık:** `pip install resend` (requirements.txt içinde).

## Davranış

- `get_metrics()` → `check_alerts()` çağrıldığında (dashboard veya pipeline) eşik aşımı varsa uyarı listesi oluşur.
- Liste dolu ve `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TO` tanımlıysa **tek e-posta** gönderilir (konu: `[Kripto İzleme] N uyarı`, gövde: tüm uyarı maddeleri).
- Değerler tanımlı değilse e-posta gönderilmez; uyarılar yalnızca panelde ve `data/alert_history.json` içinde kalır.

## Referans

- Resend API: https://resend.com/docs/send-with-python
- config/monitoring.yaml — alert eşikleri (drawdown_pct_gt, execution_rate_lt)
- src/alert_email.py — send_alert_email()
- src/alerts.py — check_alerts() içinde send_alert_email() çağrısı
