# The Math Needed for Trading on Polymarket (Complete Roadmap)

**Roan** · [@RohOnChain](https://x.com/RohOnChain) · 30 Oca

Polymarket'te işlem yapmak için gereken matematiği parçalara ayırıyorum. Bana kişisel olarak yardımcı olan yol haritasını ve kaynakları da paylaşacağım.

---

## Giriş

Son bir araştırma makalesi gerçeği ortaya koydu: Sofistike trader'lar bir yılda Polymarket'ten **40 milyon dolar** garanti arbitraj kârı çıkardı. En iyi tek trader **2.009.631,76 $** kazandı. Bunlar şanslı kumarbazlar değil; Bregman projeksiyonları, Frank-Wolfe algoritmaları çalıştırıyor ve çoğu bilgisayar bilimi doktorasını zorlayacak optimizasyon problemleri çözüyorlar.

> **Bookmark This** — Ben Roan, sistem tasarımı, HFT tarzı execution ve kantitatif işlem sistemleri üzerine çalışan bir backend geliştiriciyim. Odak noktam, tahmin piyasalarının yük altında nasıl davrandığı.

YES'in 0,62 $ ve NO'nun 0,33 $ olduğu bir piyasada "toplam 0,95 $, arbitraj var" diyorsun. Haklısın. Çoğu insanın fark etmediği şey: Sen YES + NO = 1 $ mı diye manuel kontrol ederken, kantitatif sistemler **2^63 olası sonuç** üzerinde **17.218 koşulu** tarayan tamsayı programlarını milisaniyeler içinde çözüyor. İnsan iki emri koyana kadar spread gitmiş oluyor. Sistemler aynı ihlali onlarca ilişkili piyasada bulmuş, order book derinliği ve komisyonları hesaba katan optimal pozisyon büyüklüklerini hesaplamış, paralel atomik olmayan işlemleri yürütmüş ve sermayeyi bir sonraki fırsata döndürmüş oluyor.

**Fark sadece hız değil. Matematiksel altyapı.**

Bu yazının sonunda Polymarket'ten 40 milyon dolar çıkaran optimizasyon çerçevelerini anlayacaksın. Basit toplamanın neden yetmediğini, tamsayı programlamanın üstel arama uzayını nasıl sıkıştırdığını ve Bregman diverjansının fiyatlamadaki verimlilik için ne anlama geldiğini bileceksin. Daha önemlisi, hobi projelerini milyonlarca sermaye çalıştıran üretim sistemlerinden ayıran kod kalıplarını ve algoritmik stratejileri göreceksin.

> **Not:** Bu metin özetlenerek okunacak bir metin değil. Yedi haneli sistemler kurmaya ciddiysen baştan sona oku. Hızlı kazanç veya "vibe coding" arıyorsan bu senin için değil.

---

## Bölüm I: Marjinal Politop Problemi (Basit Matematiğin Neden Yetmediği)

### Çok Koşullu Piyasaların Gerçeği

**Tek koşullu piyasa:** "Trump Pennsylvania'yı kazanacak mı?"

|       | Fiyat  |
|-------|--------|
| YES   | $0.48  |
| NO    | $0.52  |
| **Toplam** | **$1.00** |

Mükemmel görünüyor. Arbitraj yok, değil mi? **Yanlış.**

İkinci bir piyasa ekle: "Cumhuriyetçiler Pennsylvania'da 5+ puanla kazanacak mı?"

|       | Fiyat  |
|-------|--------|
| YES   | $0.32  |
| NO    | $0.68  |

İkisi de 1'e toplanıyor. Hâlâ normal görünüyor. Ama **mantıksal bir bağımlılık** var: Cumhuriyetçiler 5+ puanla kazanırsa Trump Pennsylvania'yı kazanmak zorunda. Bu piyasalar bağımsız değil — bu da arbitraj yaratıyor.

### Matematiksel Çerçeve

*n* koşullu her piyasa için **2^n** olası fiyat kombinasyonu vardır. Ama **tam bir koşul TRUE** çözülmek zorunda olduğu için yalnızca **n geçerli sonuç** vardır.

Geçerli ödeme vektörleri kümesi:

```
Z = { φ(ω) : ω ∈ Ω }
```

Burada φ(ω), ω sonucunda hangi koşulun TRUE olduğunu gösteren ikili vektördür.

**Marjinal politop**, bu geçerli vektörlerin konveks zarfıdır:

```
M = conv(Z)
```

Arbitrajsız fiyatlar **M** içinde olmalıdır. M dışındaki her şey sömürülebilir.

**Pennsylvania örneği:**

- Piyasa A: 2 koşul → 2 geçerli sonuç  
- Piyasa B: 2 koşul → 2 geçerli sonuç  
- Naif birleşik kontrol: 2 × 2 = **4** olası sonuç  
- **Gerçek geçerli sonuç sayısı: 3** (bağımlılık birini eliyor)

Fiyatlar 4 bağımsız sonuç varsayıp sadece 3 tane varken, yanlış fiyatlama garanti kâr yaratır.

### Brute Force Neden Çöküyor?

NCAA 2010 turnuva piyasası:

- 63 maç (her biri kazanma/kaybetme)
- **2^63 = 9.223.372.036.854.775.808** olası sonuç
- 5.000+ menkul kıymet

Her kombinasyonu kontrol etmek hesaplama açısından imkansız. Araştırma, yalnızca 2024 ABD seçimlerinde **1.576 potansiyel bağımlı piyasa çifti** buldu. Naif çiftli doğrulama her çift için 2^(n+m) kombinasyon kontrolü gerektirir. Piyasa başına sadece 10 koşulda bile çift başına **2^20 = 1.048.576** kontrol. 1.576 çiftle çarp. Seçim sonuçları açıklanırken laptop hâlâ hesaplıyor olacak.

### Tamsayı Programlama Çözümü

Sonuçları saymak yerine, geçerli kümeyi **doğrusal kısıtlarla** tanımla:

```
Z = { z ∈ {0,1}^I : A^T × z ≥ b }
```

**Duke vs Cornell piyasasından gerçek örnek:**

- Her takımın 7 menkul kıymeti var (0–6 galibiyet). 14 koşul → **2^14 = 16.384** kombinasyon.
- İkisi de 5+ maç kazanamaz çünkü yarı finalde karşılaşırlar.

**Tamsayı programlama kısıtları:**

- `sum(z_duke, 0..6) = 1`
- `sum(z_cornell, 0..6) = 1`
- `z(duke,5) + z(duke,6) + z(cornell,5) + z(cornell,6) ≤ 1`

Üç doğrusal kısıt, 16.384 brute force kontrolün yerini alıyor. Kantitatif sistemler üstel karmaşıklığı böyle yönetiyor: saymıyorlar, **kısıtlıyorlar**.

### Gerçek Veriden Tespit Sonuçları

Araştırma ekibi Nisan 2024 – Nisan 2025 piyasalarını analiz etti:

| Metrik | Değer |
|--------|--------|
| İncelenen toplam koşul | 17.218 |
| Tek piyasa arbitrajı gösteren koşul | 7.051 (%41) |
| Medyan yanlış fiyatlama | $0.60 / $1.00 (olması gereken $1.00) |
| Sömürülebilir arbitrajlı bağımlı piyasa çifti | 13 |

Medyan $0.60 demek, piyasaların düzenli olarak **%40** yanlış fiyatlandığı anlamına geliyor. Verimli değil; yoğun şekilde sömürülebilir.

> **Özet:** Arbitraj tespiti sayıların toplamının 1 olup olmadığını kontrol etmek değildir. Kompakt doğrusal temsillerle üstel büyüklükte sonuç uzayları üzerinde kısıt tatmin problemleri çözmektir.

---

## Bölüm II: Bregman Projeksiyonu (Arbitrajı Gerçekten Nasıl Kaldırırsın)

Arbitrajı bulmak bir problem; optimal sömürü işlemini hesaplamak başka bir problem.

Fiyatları ortalayarak veya sayıları oynayarak "düzeltemezsin". Mevcut piyasa durumunu **bilgi yapısını koruyarak** arbitrajsız manifolda **projekte** etmen gerekir.

### Standart Uzaklık Neden Yetmez?

Öklid projeksiyonu şunu minimize eder:

```
||μ - θ||²
```

Bu tüm fiyat hareketlerini eşit görür. Oysa piyasalar **maliyet fonksiyonları** kullanır. $0.50 → $0.60 hareketi ile $0.05 → $0.15 hareketi aynı 10 cent olsa bile farklı bilgi taşır. Piyasa yapıcıları fiyatların olasılık temsil ettiği **logaritmik maliyet fonksiyonları (LMSR)** kullanır. Doğru uzaklık metriği bu yapıya saygı duymalı.

### Bregman Diverjansı

Konveks fonksiyon *R* ve gradyan ∇*R* için Bregman diverjansı:

```
D(μ||θ) = R(μ) + C(θ) - θ·μ
```

- **R(μ):** Maliyet fonksiyonu C'nin konveks eşleniği  
- **θ:** Mevcut piyasa durumu  
- **μ:** Hedef fiyat vektörü  
- **C(θ):** Piyasa yapıcının maliyet fonksiyonu  

LMSR için *R*(μ) **negatif entropi**dir:

```
R(μ) = Σ μᵢ ln(μᵢ)
```

Bu da *D*(μ||θ)'yı **Kullback-Leibler diverjansı** yapar; olasılık dağılımları arasındaki bilgi-teorik uzaklığı ölçer.

### Arbitraj Kâr Formülü

Herhangi bir işlemden **maksimum garanti kâr**:

```
max_δ [ min_ω ( δ·φ(ω) - C(θ+δ) + C(θ) ) ] = D(μ*||θ)
```

Burada **μ***, θ'nın *M* üzerine **Bregman projeksiyonu**. Kanıt konveks dualite gerektirir; sonuç net: optimal arbitraj işlemini bulmak, Bregman projeksiyonunu hesaplamakla eşdeğer.

**Gerçek sayılar:** En iyi arbitrajcı bir yılda **2.009.631,76 $** çıkardı. Stratejisi bu optimizasyonu herkesten daha hızlı ve doğru çözmekti:

```
μ* = argmin_{μ ∈ M} D(μ||θ)
```

Her kârlı işlem, fiyatlar hareket etmeden önce **μ*** bulmaktı.

### Execution İçin Neden Önemli?

Arbitraj tespit ettiğinde bilmen gerekenler:

1. **Hangi pozisyonlar** (hangi koşulları al/sat)
2. **Büyüklük** (order book derinliği dahil)
3. **Beklenen kâr** (execution riski dahil)

Bregman projeksiyonu üçünü de verir: **μ*** arbitrajsız fiyat vektörü, **D(μ*||θ)** çıkarılabilir maksimum kâr, **∇D** işlem yönü. Bu çerçeve olmadan tahmin, olunca optimizasyon yapıyorsun.

> **Özet:** Arbitraj yanlış fiyatlı varlık "görmek" değildir; piyasa mikro-yapısıyla tanımlanan uzaylarda kısıtlı konveks optimizasyon çözmektir. Kârı belirleyen matematiğin kendisidir.

---

## Bölüm III: Frank-Wolfe Algoritması (Hesaplanabilir Hale Getirmek)

Bregman projeksiyonunu doğrudan hesaplamak zor. Marjinal politop *M* üstel sayıda köşeye sahip. Standart konveks optimizasyon tüm kısıt kümesine erişim ister; tahmin piyasalarında bu her geçerli sonucu saymak demek — ölçekte imkansız.

**Frank-Wolfe** projeksiyonu bir dizi **doğrusal programa** indirger.

### Temel Fikir

*M*'nin tamamı üzerinde bir seferde optimize etmek yerine, Frank-Wolfe iteratif kurar.

**Algoritma:**

1. Bilinen az sayıda köşe ile başla: **Z₀**
2. **t** iterasyonunda:
   - **a.** conv(Z_{t-1}) üzerinde konveks optimizasyon çöz:  
     `μ_t = argmin_{μ ∈ conv(Z_{t-1})} F(μ)`
   - **b.** IP ile yeni iniş köşesi bul:  
     `z_t = argmin_{z ∈ Z} ∇F(μ_t)·z`
   - **c.** Aktif kümeye ekle: **Z_t = Z_{t-1} ∪ {z_t}**
   - **d.** Yakınsama açığını hesapla:  
     `g(μ_t) = ∇F(μ_t)·(μ_t - z_t)`
   - **e.** g(μ_t) ≤ ε ise dur.

Aktif küme **Z_t** iterasyon başına bir köşe büyür. 100 iterasyondan sonra bile 2^63 yerine sadece 100 köşe takip edilir.

### Tamsayı Programlama Oracle'ı

En pahalı adım **2b**. Her iterasyonda çözülen:

```
min_{z ∈ Z} c·z   ,   c = ∇F(μ_t)
```

*c* mevcut gradyan, *Z* tamsayı kısıtlarıyla tanımlı geçerli ödeme vektörleri. Bu bir **tamsayılı doğrusal program**; genelde NP-zor, ama Gurobi gibi çözücüler yapılı problemlerde bunları verimli halleder.

Araştırma **Gurobi 5.5** kullandı. Tipik çözüm süreleri:

| Aşama | Süre |
|--------|--------|
| Erken iterasyonlar (küçük kısmi sonuçlar) | < 1 sn |
| Turnuva ortası (30–40 maç netleşmiş) | 10–30 sn |
| Turnuva sonu (50+ maç netleşmiş) | < 5 sn |

Sonlara doğru neden hızlanıyor? Sonuçlar netleştikçe uygun küme küçülüyor; daha az değişken, daha sıkı kısıtlar.

### Kontrollü Büyüme Problemi

Standart Frank-Wolfe ∇*F*'in Lipschitz sürekli ve sabitinin sınırlı olduğunu varsayar. LMSR'da **∇R(μ) = ln(μ) + 1**. μ → 0 iken gradyan −∞'a patlar; standart yakınsama kanıtları bozulur.

Çözüm **Barrier Frank-Wolfe**: *M* yerine **kontrakte politop** üzerinde optimize et:

```
M' = (1-ε)M + εu
```

*u* tüm koordinatları (0,1) içinde olan bir iç nokta, ε ∈ (0,1) kontraksiyon parametresi. ε > 0 için gradyan *M'* üzerinde sınırlıdır; Lipschitz sabiti O(1/ε). Algoritma ε'yı iterasyon ilerledikçe adaptif azaltır; ε asimptotik olarak 0'a gider, kontrakte problem gerçek projeksiyona yakınsar.

### Yakınsama Hızı

Frank-Wolfe **O(L × diam(M) / t)** hızında yakınsar (*L* Lipschitz, diam(*M*) *M*'nin çapı). LMSR + adaptif kontraksiyonla bu **O(1/(ε×t))** olur. Binlerce koşullu piyasalarda pratikte 50–150 iterasyon yeterli bulunmuş.

### Üretim Performansı

Makaleden: *"Projeksiyonlar pratikte hızlanınca FWMM, LCMM'den daha üstün doğruluk sağlıyor."*

| Zaman dilimi | Durum |
|--------------|--------|
| İlk 16 maç | LCMM ve FWMM benzer (IP çözücü yavaş) |
| 45 maç netleştikten sonra | İlk başarılı 30 dk projeksiyon |
| Turnuva geri kalanı | FWMM, LCMM'den %38 medyan iyileşme |

Kritik nokta: Sonuç uzayı, IP çözümlerinin işlem zaman dilimleri içinde bitmesine yetecek kadar küçüldüğü anda.

> **Özet:** Teorik zarafet hesaplanabilir olmadan anlamsız. Tamsayı programlama oracle'lı Frank-Wolfe, Bregman projeksiyonunu trilyonlarca sonuçlu piyasalarda pratik yapıyor. 40 milyon dolarlık arbitraj bu şekilde hesaplanıp uygulandı.

---

## Bölüm IV: Atomik Olmayan Kısıtlar Altında Execution (Order Book Neden Her Şeyi Değiştiriyor)

Arbitrajı tespit ettin. Bregman projeksiyonuyla optimal işlemi hesapladın. Sıra **execution**'da — çoğu strateji burada düşüyor.

### Atomik Olmayan Problem

Polymarket **Merkezi Limit Emir Defteri (CLOB)** kullanıyor. Tüm işlemlerin ya hepsi ya hiçbiri olduğu atomik DEX'lerin aksine, CLOB'da execution **sıralı**.

**Plan:**

- YES $0.30'dan al, NO $0.30'dan al → Toplam maliyet $0.60, garanti ödeme $1.00 → Beklenen kâr $0.40

**Gerçek:**

- YES emri → $0.30'dan dolar ✓  
- Senin emrin fiyatı günceller  
- NO emri → $0.78'den dolar ✗  
- Toplam maliyet $1.08, ödeme $1.00 → **Gerçek sonuç: -$0.08 zarar**

Bir bacak dolar, diğeri olmaz; risk açıkta kalır. Araştırma bu yüzden en az **$0.05** kâr marjı olan fırsatları saydı. Daha küçük kenarlar execution riskiyle erir.

### VWAP Analizi

Anlık, kotasyon fiyatında dolum varsaymak yerine **beklenen execution fiyatı** hesapla:

```
VWAP = Σ(price_i × volume_i) / Σ(volume_i)
```

Araştırma yöntemi: Polygon'da her blok (~2 sn) için YES/NO işlemlerinden VWAP_yes ve VWAP_no hesapla. **|VWAP_yes + VWAP_no − 1.0| > 0.02** ise arbitraj fırsatı kaydet; kâr = bu sapma. Atom zaman birimi **blok**; blok bazlı VWAP, gerçekten ulaşılabilir fiyatları yansıtır.

### Likidite Kısıtı

Fiyatlar yanlış olsa bile kârı sadece **mevcut likidite** kadar çıkarabilirsin. Örnek: Arbitraj var (YES toplamı $0.85), potansiyel kâr $0.15/dolar; bu fiyatlarda order book derinliği $234. Maksimum çıkarılabilir kâr: **234 × 0.15 = $35.10**. Araştırma fırsat başı maksimum kârı şöyle hesapladı:

```
profit = (fiyat sapması) × min(tüm gerekli pozisyonlardaki volume)
```

Çok koşullu piyasalarda **tüm** pozisyonlarda aynı anda likidite gerekir; tavanı **minimum** belirler.

### Zaman Penceresi Analizi

Araştırma ilişkili işlemleri gruplamak için **950 blok (~1 saat)** penceresi kullandı. Çünkü Polymarket'te eşleşen emirlerin **%75'i** bu sürede doluyor. Her cüzdan adresi için 950 blok içindeki tüm teklifler tek bir strateji execution'ı sayıldı; kâr = tüm olası sonuçlardaki garanti minimum ödeme − toplam maliyet.

### Execution Başarı Oranları

| Kategori | Tespit | Execution |
|----------|--------|-----------|
| Tek koşul arbitrajı | 7.051 koşul, çoğu sömürüldü | %41 koşulda fırsat |
| Piyasa rebalansı | Çok koşullu piyasaların %42'si | — |
| Kombinatoryal arbitraj | 13 geçerli çift | 5'inde execution |

Tespit ile execution arasındaki fark **execution riski**.

### Hız Katmanları

| Katman | Perakende | Sofistike sistem |
|--------|-----------|-------------------|
| Polymarket API / WebSocket | ~50 ms | <5 ms (push) |
| Eşleştirme / Karar | ~100 ms | <10 ms (önceden hesaplı) |
| RPC / Paralel execution | — | ~15 ms + ~10 ms |
| Polygon blok / yayılım | ~2.000 ms / ~500 ms | ~2.000 ms |
| **Toplam** | **~2.650 ms** | **~2.040 ms** |

Zincirde gördüğün 20–30 ms, karar–mempool süresi. Hızlı cüzdanlar tüm bacakları 30 ms içinde gönderip aynı blokta onaylatarak sıralı execution riskini ortadan kaldırıyor. Sen Block N+1'de kopyaladığında, sub-saniyelik fırsattan **4 saniye** geridesin.

### Hızlı Cüzdanları Kopyalamak Neden Başarısız?

- **Block N-1:** Hızlı sistem yanlış fiyatı görür, 30 ms'de 4 işlem gönderir.  
- **Block N:** Hepsi onaylanır, arbitraj kapılır; sen bunu görürsün.  
- **Block N+1:** Sen aynı işlemi kopyalarsın, fiyat artık $0.78 (eskiden $0.30).  

Arbitraj yapmıyorsun; **çıkış likiditesi** sağlıyorsun. Order book derinliği de seni vurur: Hızlı cüzdan 50.000 token alır (VWAP $0.322). Piyasa hareket eder. Sen 5.000 tokenı sonra alırsın (VWAP $0.344). Onlar $0.322, sen $0.344 ödedin; 10 centlik kenar senin için 2.2 cent zarar olur.

### Sermaye Verimliliği

En iyi arbitrajcı **500K+ $** sermaye ile çalıştı. $5K ile aynı strateji kırılır: Slippage küçük pozisyonların daha büyük yüzdesini yer; yeterli fırsata yayılamazsın; tek başarısız execution günlerin kârını siler; sabit maliyetler (gas) kâr marjını yer. 4 bacaklı stratejide gas ~$0.02. $0.08 kârda %25, $0.03 kârda %67 gider — bu yüzden $0.05 minimum eşik var.

### Gerçek Execution Verisi

**Tek koşul arbitrajı:** Tespit 7.051, execution başarısı %87. Başarısızlık: likidite %48, fiyat hareketi %31, rekabet %21.

**Kombinatoryal arbitraj:** 13 çift tespit, %45 execution. Başarısızlık: aynı anda yetersiz likidite %71, hız rekabeti %18.

> **Özet:** Matematiksel doğruluk gerekli ama yeterli değil. Execution hızı, order book derinliği ve atomik olmayan dolum riski gerçek kârı belirliyor. 40 milyon dolar, sofistike aktörlerin sadece matematiği değil execution problemlerini de çözdüğü için çıkarıldı.

---

## Bölüm V: Bütün Sistem (Gerçekte Devreye Giren)

Teori temiz, üretim dağınık. Araştırma bulgularına ve pratik ihtiyaçlara göre **çalışan bir arbitraj sistemi** şöyle görünüyor.

### Veri Hattı

**Gerçek zamanlı:**

- Polymarket CLOB API **WebSocket**
  - Order book güncellemeleri (fiyat/hacim)
  - İşlem/execution feed'i
  - Piyasa oluşturma/settlement olayları

**Tarihsel analiz:**

- **Alchemy Polygon** node API  
  - Kontrat `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` olayları  
  - `OrderFilled`, `PositionSplit`, `PositionsMerge`  

86 milyon işlem analiz edildi; bu hacim script değil **altyapı** gerektirir.

### Bağımlılık Tespit Katmanı

305 ABD seçim piyasası için **46.360** olası çift var. Manuel analiz imkansız. Araştırma **DeepSeek-R1-Distill-Qwen-32B** + prompt mühendisliği kullandı:

- **Girdi:** İki piyasa + koşul açıklamaları  
- **Çıktı:** Geçerli sonuç kombinasyonlarının JSON'u  

Doğrulama: (1) Her piyasada sonuç başına tam bir TRUE koşul mu? (2) Geçerli kombinasyon sayısı n×m'den az mı (bağımlılık)? (3) Bağımlı alt kümeler arbitraj koşullarını sağlıyor mu?

**Seçim piyasaları sonucu:**

- 40.057 bağımsız çift  
- 1.576 bağımlı çift  
- 374 kesin kombinatoryal koşulu sağlayan  
- 13 manuel doğrulamada sömürülebilir  

Karmaşık çok koşullu piyasalarda **%81.45** doğruluk; filtreleme için yeterli, execution için manuel doğrulama gerekli.

### Optimizasyon Motoru

**Üç katmanlı arbitraj giderme:**

1. **Katman 1 — Basit LCMM kısıtları**  
   Hızlı LP gevşetmeleri: "olasılıklar toplamı 1", "A ⇒ B ise P(A) ≤ P(B)" vb. Milisaniyeler; bariz yanlış fiyatları temizler.

2. **Katman 2 — Tamsayı programlama projeksiyonu**  
   Frank-Wolfe + Gurobi IP. Parametreler: Alpha=0.9, başlangıç epsilon=0.1, yakınsama 1e-6, zaman limiti 30 dk (piyasa küçüldükçe azalır). Tipik 50–150 iterasyon; iterasyon başı 1–30 sn.

3. **Katman 3 — Execution doğrulama**  
   Emir göndermeden önce mevcut order book'a karşı dolum simülasyonu: Likidite yeterli mi? Beklenen slippage? Slippage sonrası garanti kâr? Minimum eşik ($0.05) aşılıyor mu? Hepsi geçerse execution.

### Pozisyon Büyüklüğü

Execution riski dahil **modifiye Kelly**:

```
f = (b×p - q) / b × √p
```

*b* arbitraj kâr yüzdesi, *p* tam execution olasılığı (order book derinliğinden), *q = 1−p*. Piyasayı hareket ettirmemek için order book derinliğinin **%50'si** ile sınır.

### İzleme Panosu

Gerçek zamanlı: dakikada tespit/execution fırsatı, execution başarı oranı, toplam kâr, drawdown, ortalama gecikme. Uyarılar: drawdown >%15, execution oranı <%30, IP timeout artışı, dolum hataları. En iyi arbitrajcı **4.049** işlem yaptı — yaklaşık yılda günde 11 işlem; geleneksel anlamda HFT değil, sistematik ve sürekli.

### Somut Sonuçlar (Nisan 2024 – Nisan 2025)

| Kategori | Tutar |
|----------|--------|
| Tek koşul — ikisini <$1 al | $5.899.287 |
| Tek koşul — ikisini >$1 sat | $4.682.075 |
| **Tek koşul toplam** | **$10.581.362** |
| Rebalans — tüm YES <$1 al | $11.092.286 |
| Rebalans — tüm YES >$1 sat | $612.189 |
| Rebalans — tüm NO al | $17.307.114 |
| **Rebalans toplam** | **$29.011.589** |
| Kombinatoryal (çapraz piyasa) | $95.634 |
| **Genel toplam** | **$39.688.585** |

- Top 10: **$8.127.849** (%20.5)  
- En iyi tek çıkarıcı: **$2.009.632** (4.049 işlem)  
- En iyi oyuncu için işlem başı ortalama kâr: **$496**  

Piyango veya şans değil; **matematiksel hassasiyet**, sistematik execution.

### Kazananları Kaybedenlerden Ayıran

**Perakende:** 30 sn'de bir fiyat kontrolü, YES+NO≈1 mi bak, belki spreadsheet, manuel emir, umut.  

**Kantitatif:** Gerçek zamanlı WebSocket, bağımlılık için tamsayı programlama, optimal işlem için Frank-Wolfe + Bregman projeksiyonu, VWAP tahminli paralel execution, execution kısıtları altında sistematik pozisyon büyüklüğü. 2.65 sn gecikme vs 30 sn polling. Bir grup 40 milyon dolar çıkardı; diğeri likidite sağladı.

> **Özet:** Üretim sistemleri hem matematiksel titizlik hem mühendislik sofistikasyonu ister: optimizasyon teorisi, dağıtık sistemler, gerçek zamanlı veri, risk yönetimi, execution algoritmaları. Matematik temel; kârlı yapan altyapı.

---

## Sonuç

"Tahmin piyasaları için 10 ipucu" okunurken kantitatif sistemler:

- 17.218 koşulda tamsayı programları çözüyor,
- Optimal arbitraj için Bregman projeksiyonları hesaplıyor,
- Kontrollü gradyan büyümesiyle Frank-Wolfe çalıştırıyor,
- VWAP tabanlı slippage ile paralel emir atıyor,
- Sistematik biçimde **40 milyon dolar** garanti kâr çıkarıyordu.

Fark şans değil; **matematiksel altyapı**. Araştırma makalesi açık, algoritmalar biliniyor, kârlar gerçek. Soru: Bir sonraki 40 milyon çıkarılmadan **bunu sen kurabilecek misin?**

---

## Kaynaklar

| Kaynak | Açıklama |
|--------|----------|
| Araştırma makalesi | [Unravelling the Probabilistic Forest: Arbitrage in Prediction Markets](https://arxiv.org/abs/2508.03474) (arXiv:2508.03474v1) |
| Teori temeli | [Arbitrage-Free Combinatorial Market Making via Integer Programming](https://arxiv.org/abs/1606.02825) (arXiv:1606.02825v2) |
| IP çözücü | Gurobi Optimizer |
| LLM (bağımlılıklar) | DeepSeek-R1-Distill-Qwen-32B |
| Veri | Alchemy Polygon node API |

Matematik işliyor. Altyapı mevcut. Geriye kalan tek soru: **execution.**

---

*Part 2 ister misiniz? Aşağıda yazın.*
