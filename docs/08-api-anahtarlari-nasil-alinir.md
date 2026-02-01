# API Anahtarları Nasıl Alınır — Detaylı Rehber

**Doküman:** Tüm proje API key’lerinin nereden ve nasıl alınacağı  
**Versiyon:** 1.0  
**Son güncelleme:** 2025-02-01  
**İlişkili:** `.env`, docs/07-kullanilacak-api-ler.md

Bu rehber, Polymarket arbitraj projesinde kullanılan her API için anahtar/erişim bilgisinin **nasıl bulunacağını** adım adım anlatır.

---

## 1. Polymarket CLOB — API Key, Secret, Passphrase

Polymarket’te “kayıt olup panelden API key indirmek” yok. **L2 kimlik bilgileri (apiKey, secret, passphrase)** cüzdanınızın **private key**’i ile CLOB client üzerinden **üretilir** veya **geri türetilir**.

### 1.1 Ne Lazım?

- **Polygon cüzdanı** (MetaMask vb.) ve o cüzdanın **private key**’i.
- Polymarket’te **en az bir kez giriş yapmış** olmanız iyi olur; böylece proxy wallet (funder) adresi oluşur. Adres: [polymarket.com/settings](https://polymarket.com/settings) → profil adresiniz.

### 1.2 L1 ve L2 Nedir?

| Seviye | Açıklama |
|--------|----------|
| **L1** | Cüzdan private key ile mesaj imzalama. Emir imzalama ve **L2 credential üretme** için kullanılır. |
| **L2** | API key + secret + passphrase. REST/WebSocket’te emir gönderme, bakiye, açık emirler vb. için kullanılır. |

L2 bilgileri **Polymarket sitesinden indirilmez**; **CLOB client** ile private key kullanılarak `create_api_key()` / `create_or_derive_api_creds()` veya `derive_api_key(nonce)` ile alınır.

### 1.3 Script ile Credential Alma (Önerilen)

Projede **hazır script** var; private key’i `.env`’e yazıp script’i çalıştırmanız yeterli.

1. **.env dosyasına** Polygon cüzdanınızın **private key**’ini ekleyin:  
   - Format: **0x** ile başlayan **64 hex karakter** (toplam 66 karakter). Örnek: `0x1a2b3c...`  
   - **Cüzdan adresi (address) değil!** Adres 0x + 40 karakterdir; private key 0x + 64 karakterdir.  
   - MetaMask: Hesap → “Hesap detayları” → “Özel anahtarı dışa aktar” (şifreyi girin, kopyalayın).  
   - Private key’i **asla** paylaşmayın veya sohbette yazmayın; .env git’e eklenmez.

2. **Bağımlılıkları kurun:**  
   `pip install py-clob-client python-dotenv`

3. **Script’i çalıştırın:**  
   `python scripts/get_polymarket_api_credentials.py`

4. **Çıktıdaki** `POLYMARKET_API_KEY`, `POLYMARKET_API_SECRET`, `POLYMARKET_PASSPHRASE` satırlarını kopyalayıp **.env** dosyasına yapıştırın.

5. **Nonce’u saklayın:** Credential’ları kaybederseniz aynı nonce ile `derive_api_key(nonce)` ile geri alabilirsiniz (script şu an nonce’u göstermiyor; ilk oluşturmada nonce 0 kullanılır).

**Not:** Polymarket’te bu cüzdanla **en az bir kez giriş** yapmış olmanız iyi olur; böylece proxy wallet (funder) oluşur. [polymarket.com/settings](https://polymarket.com/settings) üzerinden adresinizi kontrol edebilirsiniz.

### 1.4 Adım Adım — Manuel (Python kodu)

**Yöntem A — Python (py-clob-client)**

1. Polymarket CLOB Python client’ı kurun:  
   `pip install py-clob-client`  
   Repo: [github.com/Polymarket/py-clob-client](https://github.com/Polymarket/py-clob-client)

2. Private key’i güvenli şekilde kullanın (ortam değişkeni önerilir):

```python
from py_clob_client.client import ClobClient
import os

host = "https://clob.polymarket.com"
chain_id = 137  # Polygon mainnet
private_key = os.getenv("PRIVATE_KEY")  # 0x... formatında

client = ClobClient(host=host, chain_id=chain_id, key=private_key)

# Yeni credential üret (ilk kez)
api_creds = client.create_or_derive_api_creds()

# api_creds = {
#   "apiKey": "550e8400-e29b-41d4-a716-446655440000",
#   "secret": "base64EncodedSecretString",
#   "passphrase": "randomPassphraseString"
# }
```

3. Dönen **apiKey**, **secret**, **passphrase** değerlerini `.env` dosyasına yazın:
   - `POLYMARKET_API_KEY` = apiKey  
   - `POLYMARKET_API_SECRET` = secret  
   - `POLYMARKET_PASSPHRASE` = passphrase  

4. **Nonce’u saklayın:** Credential’ları kaybettiğinizde aynı nonce ile `deriveApiKey(nonce)` ile geri alabilirsiniz. Nonce’u güvenli bir yerde not edin.

**Yöntem B — TypeScript (clob-client)**

- Repo: [github.com/Polymarket/clob-client](https://github.com/Polymarket/clob-client)  
- `Wallet` (ethers) + `ClobClient` ile `createOrDeriveApiKey()` çağrısı yapın; dönen objede apiKey, secret, passphrase vardır.

### 1.5 Önemli Notlar

- **Private key** asla paylaşılmaz ve git’e konmaz; sadece sizin çalıştırdığınız ortamda (env) kullanılır.
- Emir gönderirken **funder** adresi: Polymarket’te giriş yaptığınızda oluşan proxy wallet adresi; [polymarket.com/settings](https://polymarket.com/settings) üzerinden bakabilirsiniz.
- Resmi dokümantasyon: [docs.polymarket.com/developers/CLOB/authentication](https://docs.polymarket.com/developers/CLOB/authentication)  
- Rate limit ve endpoint listesi: [docs.polymarket.com/quickstart/introduction/rate-limits](https://docs.polymarket.com/quickstart/introduction/rate-limits), [docs.polymarket.com/quickstart/reference/endpoints](https://docs.polymarket.com/quickstart/reference/endpoints)

---

## 2. Alchemy — Polygon API Key

Alchemy, Polygon mainnet için RPC ve event sorgulama sağlar. **Ücretsiz plan** ile başlayabilirsiniz.

### 2.1 Kayıt ve Uygulama Oluşturma

1. **Kayıt:**  
   [https://dashboard.alchemy.com/signup](https://dashboard.alchemy.com/signup)  
   Google veya e-posta ile üye olun.

2. **Yeni uygulama (App):**  
   - Dashboard’da **“Create new app”** (veya “Apps” → “Create new app”).  
   - **Chain:** Polygon  
   - **Network:** Polygon Mainnet.  
   - İsim ve açıklama girin, oluşturun.

3. **API key’i bulma:**  
   - Oluşturduğunuz app’e tıklayın.  
   - **“API key”** veya **“View key”** butonuna tıklayın.  
   - **HTTPS** URL şu formatta olacaktır:  
     `https://polygon-mainnet.g.alchemy.com/v2/SIZIN_API_KEY`

### 2.2 .env’e Yazma

- `ALCHEMY_POLYGON_API_KEY` = URL’deki `v2/` sonrası kısım (sadece key).  
- `ALCHEMY_POLYGON_RPC_URL` = Tam URL: `https://polygon-mainnet.g.alchemy.com/v2/SIZIN_API_KEY`

### 2.3 Rate Limit ve Dokümantasyon

- Ücretsiz planda istek/dakika limiti vardır; aşılmadan önce uyarı eklemeniz önerilir (SOP-Kurulum §2.2.4).  
- API key oluşturma: [alchemy.com/docs/create-an-api-key](https://www.alchemy.com/docs/create-an-api-key)  
- Polygon hızlı başlangıç: [alchemy.com/docs/reference/polygon-api-quickstart](https://www.alchemy.com/docs/reference/polygon-api-quickstart)

---

## 3. DeepSeek (veya Alternatif LLM) — API Key

Projede bağımlılık tespiti için LLM kullanılıyor; referans model: **DeepSeek-R1-Distill-Qwen-32B**. API key, DeepSeek’in kendi platformundan alınır.

### 3.1 DeepSeek API Key Alma

1. **Kayıt:**  
   [https://www.deepseek.com](https://www.deepseek.com) → “Kaydol” / Sign up.  
   E-posta veya GitHub ile üye olun; e-posta doğrulaması yapın.

2. **API paneline giriş:**  
   [https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)  
   (Giriş yaptıktan sonra “API Keys” veya “Geliştirici” bölümüne gidin.)

3. **Yeni API key:**  
   - “Create API Key” / “API Anahtarı Oluştur” tıklayın.  
   - İsim verin (örn. polymarket-arbitrage).  
   - Oluşan key’i **bir kez** gösterilir; kopyalayıp güvenli yerde saklayın.

4. **.env’e yazma:**  
   `DEEPSEEK_API_KEY` = kopyaladığınız key.

### 3.2 Kullanım ve Limitler

- API, OpenAI uyumlu format kullanır; base URL: `https://api.deepseek.com/v1`.  
- Ücretsiz/kotalı kullanım olabilir; kullanım koşullarını siteden kontrol edin.  
- Alternatif: OpenAI (`OPENAI_API_KEY`), Anthropic vb. kullanırsanız, `config/dependency_detection.yaml` içinde provider ve model adını değiştirmeniz yeterli.

---

## 4. Gurobi — Lisans (Opsiyonel)

IP çözücü olarak Gurobi kullanıyorsanız, lisans dosyası veya lisans sunucusu gerekir.

### 4.1 Akademik (Ücretsiz) Lisans

- **Uygunluk:** Akredite üniversitelerde öğrenci, öğretim üyesi veya personel; eğitim/araştırma için.  
- **Kayıt:** [https://portal.gurobi.com/iam/register/](https://portal.gurobi.com/iam/register/) — akademik e-posta ile.  
- **Lisans talebi:** [Gurobi User Portal](https://portal.gurobi.com/iam/licenses/request?type=academic) → Academic → Named-User License seçin.  
- **Kurulum:** İndirilen Gurobi Optimizer’ı kurun; terminalde `grbgetkey LİSANS_ID` çalıştırın; oluşan lisans dosyasının yolunu `.env` içinde `GRB_LICENSE_FILE` olarak verin.

### 4.2 Ticari Kullanım

- [gurobi.com](https://www.gurobi.com) üzerinden ticari lisans satın alınır.  
- Projede Gurobi kullanmıyorsanız `GRB_LICENSE_FILE` boş bırakılabilir; alternatif çözücü (örn. HiGHS) kullanılabilir.

---

## 5. Web Yönetim Paneli — Secret

Bu bir üçüncü taraf API’si değil; kendi backend’inizde oturum/JWT imzası için kullanacağınız gizli bir string.

### 5.1 Nasıl “Bulunur”?

- **Üretirsiniz:** Örn. 32+ karakter rastgele string (OpenSSL ile: `openssl rand -hex 32`).  
- `.env` içinde: `WEB_ADMIN_SECRET` = bu string.  
- Asla git’e veya paylaşıma vermeyin; production’da güçlü ve benzersiz olsun.

---

## 6. Özet Tablo — Nereden Alınır?

| Parametre | Nereden | Nasıl |
|-----------|---------|--------|
| POLYMARKET_API_KEY, _SECRET, _PASSPHRASE | Polymarket CLOB client | Cüzdan private key ile `create_or_derive_api_key()` (Python/TS client) |
| ALCHEMY_POLYGON_API_KEY | Alchemy Dashboard | Kayıt → Create app (Polygon Mainnet) → API key kopyala |
| ALCHEMY_POLYGON_RPC_URL | Aynı | `https://polygon-mainnet.g.alchemy.com/v2/<API_KEY>` |
| DEEPSEEK_API_KEY | DeepSeek Platform | platform.deepseek.com → API Keys → Create |
| GRB_LICENSE_FILE | Gurobi Portal | Akademik kayıt → lisans indir → grbgetkey → dosya yolu |
| WEB_ADMIN_SECRET | Kendi üretiminiz | openssl rand -hex 32 vb. |

---

## 7. Güvenlik Uyarıları

- **Private key** ve tüm API key’ler yalnızca ortam değişkeni (`.env`) veya secret manager’da tutulmalı; koda veya git’e **yazılmamalı**.  
- `.env` dosyası `.gitignore`’da olmalı (projede tanımlı).  
- Production’da farklı key’ler kullanın; test key’leri canlıda kullanılmamalı.  
- Polymarket L2 credential’ları kaybederseniz, **nonce**’u sakladıysanız `deriveApiKey(nonce)` ile geri alabilirsiniz; nonce yoksa yeni credential üretmeniz gerekir.

---

**Referanslar:**  
- Polymarket CLOB Auth: [docs.polymarket.com/developers/CLOB/authentication](https://docs.polymarket.com/developers/CLOB/authentication)  
- Alchemy: [alchemy.com/docs/create-an-api-key](https://www.alchemy.com/docs/create-an-api-key)  
- DeepSeek: [platform.deepseek.com](https://platform.deepseek.com)  
- Gurobi Academic: [gurobi.com/academia](https://www.gurobi.com/academia)

---

## 8. Güvenlik Notu

**Alchemy API key’i:** Bu key’i (URL içinde) herhangi bir yerde paylaştıysanız, Alchemy Dashboard’dan **yeni bir uygulama/key oluşturup** eskisini iptal edin; böylece yetkisiz kullanım engellenir.
