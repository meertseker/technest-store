# Senaryo 7: Tablodan ürün yükleme (CSV) ve ürün kuralları

- **Süre:** yaklaşık 5 dakika
- **Gerekenler:** admin.technest.co.uk'a giriş yapılmış bir bilgisayar (tablo büyük ekranda daha kolay); Excel, Numbers veya Google E-Tablolar.
- **Nerede:** menü → **"Import products"** (Ürünleri içe aktar, adres `/app/import`).
- **Durum:** 2026-09-30'da bitmiş panel koduyla karşılaştırıldı. ⚠ işaretli adımlar Medusa'nın kendi ekranlarıdır.

Bu senaryo her ürünün uyduğu kuralları da anlatır: şarj ürünlerinde güvenlik işareti, vape'in asla
satılmaması, £1'lık ek ürünler (add-on), "3 al 2 öde" kampanyası ve yeniden sipariş seviyeleri.

---

### Sahne 1 (0:00-0:40) Şablonu indirin

**Dokunun:** menü → **"Import products"** → **"Download template"** ("Şablonu indir").

**Göreceğiniz:** başlık satırı ve üç örnek içeren `tech-nest-import-template.csv` dosyası: bir kılıf, bir USB-C kablo ve £1'lık bir telefon yüzüğü.

**Söyleyin:** "Her satır bir ürün. Anahtar, stok kodum olan **sku** sütunu: zaten olan bir SKU güncellenir, yeni bir SKU yeni ürün olur."

### Sahne 2 (0:40-1:45) Doldurun

**Dokunun:** dosyayı tablo programında açın. Örneklerin yerine kendi ürünlerinizi yazın. **CSV** olarak kaydedin.

**Söyleyin (önemli sütunlar):**
- "`title` başlık, `price_gbp` sterlin ve KDV dahil fiyat (6.99 gibi), `stock` dükkandaki adet."
- "`category`: kategorinin adı ya da web adı, `cases` veya `chargers-cables` gibi."
- "`status`: `published` (yayında) ya da `draft` (taslak). Boşsa yayında."
- "`device_slugs`: uyduğu cihazların web adları, `;` ile ayrılmış: `iphone-16;iphone-16-plus`."
- "`safety_marking`: `UKCA`, `CE` ya da `none`. Şarj ve güç ürünleri UKCA veya CE ister."
- "`is_addon_item`: £1'lık ek ürünler için `yes`."
- "`reorder_level`: stok bu sayıya düşünce ürün 08:00'deki düşük stok e-postasına girer. Boşsa 3."

### Sahne 3 (1:45-2:45) Yüklemeden önce kontrol

**Dokunun:** **"Choose CSV file"** ("CSV dosyası seç") ve dosyanızı seçin.

**Göreceğiniz:** "Checking your file…" (dosya kontrol ediliyor), sonra "Check before importing: 12 new products, 3 updates, 1 row with problems, 2 drafts." (12 yeni ürün, 3 güncelleme, 1 sorunlu satır, 2 taslak) ve **"All"**, **"Problems"** (sorunlar), **"Warnings"** (uyarılar) düğmeleri. Her satırda **"New"** (yeni), **"Update"** (güncelleme) ya da **"Problem"** etiketi ve **"Live"** (yayında) ya da **"Draft"** (taslak) yazar.

**Dokunun:** **"Problems"**. Her mesajı okuyun. O satırları tabloda düzeltip kaydedin ve **"Choose another CSV file"** ile tekrar seçin.

**Söyleyin:** "Import'a basana kadar hiçbir şey değişmez. Sorunlu satırlar atlanır, diğerleri yüklenir."

### Sahne 4 (2:45-3:15) Yükleyin

**Dokunun:** **"Import 15 products"** ("15 ürünü içe aktar").

**Göreceğiniz:** "Done. 12 products added, 3 products updated… See products" (bitti: 12 eklendi, 3 güncellendi).

**Söyleyin:** "Aynı dosyayı iki kez yüklemek hiçbir şeyi değiştirmez; yani gönül rahatlığıyla tekrar deneyebilirim."

### Sahne 5 (3:15-4:00) Birçok üründe tek bir şeyi değiştirmek

**Söyleyin:** "Sadece bir şeyi, örneğin yeniden sipariş seviyesini ya da güvenlik işaretini değiştirmek için sadece `sku` ve o sütundan oluşan bir dosya yaparım. Boş hücre 'olanı koru' demektir."

**Dokunun:** iki sütunlu bir dosya gösterin: `sku,reorder_level` ve altında `TN-CBL-CC-1M,10`. Yükleyin.

### Sahne 6 (4:00-5:00) Ürün kuralları

**Söyleyin:**
- "**Şarj ve güç ürünleri** (Chargers & Cables, Power Banks, Gaming Charging) yayınlanmak için UKCA veya CE ister. İşaret yoksa içe aktarma onları 'Imported as a draft: chargers and power products need a safety marking…' uyarısıyla **taslak** kaydeder. Kutudaki işarete bakıp sütunu doldururum ve `status` `published` yaparak tekrar yüklerim."
- "**Vape** internetten asla satılmaz. Vape'e benzeyen satır 'Problem' olur ve taslak olarak bile yüklenmez."
- "**£1'lık ek ürünler** (`is_addon_item` yes, £1 Deals kategorisinde) her sepete girebilir; ama sadece ek üründen oluşan sepet kargoyla gönderilemez: müşteri başka bir ürün eklemeli ya da Click & Collect seçmeli."
- "**3 al 2 öde**: £1 Deals kategorisinden herhangi 3 ürün, üçüncüsü bedava; sepet başına en fazla 10 bedava ürün. Otomatik, kod gerekmez. **'Promotions'** (Kampanyalar) altında `ADDONS-3-FOR-2` adıyla duruyor, oradan kapatabilirim. ⚠ £1 Deals kategorisi ile add-on işaretini hep aynı tutarım: kampanya kategoriye, kargo kuralı işarete bakar."

---

## Ne ters gidebilir

| Gördüğünüz | Anlamı / ne yapmalı |
|---|---|
| "The file has no "sku" column…" | Şablondan başlayın, başlık satırını silmeyin. |
| "This file is too big. Split it into files of up to 2000 rows." | Dosyayı en fazla 2000 satırlık parçalara bölün. |
| "Safety marking "FCC" must be UKCA, CE or none." | Bu üç kelimeden birini kullanın. |
| Vape satırında "… Remove this row." | Vape internetten asla satılmaz. Satırı silin. |
| Birden çok varyantı (renk, beden) olan üründe uyarı | Sadece fiyatı ve stoğu güncellenir. Gerisini ürün sayfasında değiştirin. |
| Fiyatlar 100 kat büyük görünüyor | Peni (`699`) değil sterlin (`6.99`) yazın. |
| Excel `1-deals`i ya da model numaralarını tarihe çeviriyor | Yazmadan önce sütunu **Metin** (Text) biçimine alın ya da Google E-Tablolar kullanın. |

## Unutmayın

- Eşleştirme anahtarı **SKU**. Aynı SKU = güncelleme, yeni SKU = yeni ürün.
- Mevcut bir üründe boş hücre = eski değer kalır.
- Şarj ve güç ürünleri: UKCA veya CE, yoksa sadece taslak. Vape: asla.
- £1'lık ek ürünler tek başına kargolu sipariş olamaz. Click & Collect olur.
