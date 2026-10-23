# Senaryo 10: "Price & stock", fiyat ya da stok değiştirme

- **Süre:** yaklaşık 3 dakika
- **Gerekenler:** admin.technestlondon.co.uk'a giriş yapılmış telefonunuz ve bir deneme ürünü (senaryo 1'dekilerden biri olur).
- **Nerede:** menü → **"Products"** (Ürünler) → **"Price & stock"** (Fiyat ve stok) sekmesi (adres `/app/shop-products?tab=stock`). **"Today"** sayfasındaki "draft products to publish" (yayınlanacak taslak ürünler) de aynı sekmeyi **"Drafts only"** açık olarak açar.
- **Durum:** 2026-10-11'de panel koduyla karşılaştırıldı.
- **Hedef:** ürünü bulun, fiyatını ya da kaç tane olduğunu değiştirin, Save'e basın. Ürünle ilgili diğer her şey ürün sayfasında kalır.

---

### Sahne 1 (0:00-0:30) Sekme

**Dokunun:** menü → **"Products"** → **"Price & stock"**.

**Göreceğiniz:** "Price & stock" başlığı, "Find the product, change the price or how many you have, press Save." (Ürünü bulun, fiyatı ya da adedi değiştirin, Save'e basın.), bir **"Search by name or SKU"** (ada ya da SKU'ya göre ara) kutusu ve iki düğme: **"All products"** (tüm ürünler) ve **"Drafts only"** (sadece taslaklar). Altta her ürün için bir kart (bir ürünün birkaç rengi ya da boyu varsa her biri için bir kart), en yeni üstte.

**Söyleyin:** "Ürünü açmadan fiyat ya da stok değiştirmenin kısa yolu bu. En yeni yirmi ürün görünür; eskileri arıyorum."

### Sahne 2 (0:30-1:30) Fiyat değiştirin

**Dokunun:** **"Search"**e adın bir kısmını ya da SKU'yu yazın. Kartta **"Price £ (inc. VAT)"** (fiyat, KDV dahil) alanını `5.49` yapın. **"Save"**.

**Göreceğiniz:** "USB-C cable saved" (kaydedildi), düğmede **"Saved"** yazar, kartta 5.49 görünür.

**Söyleyin:** "Fiyatlar sterlin ve KDV dahil: müşterinin ödediği rakam. Site yeni fiyatı bir dakika içinde gösterir. Toptan fiyatlar ayrı; burada değişmez."

### Sahne 3 (1:30-2:30) Stoğu değiştirin

**Dokunun:** **"In stock"** (stokta) alanına raftaki sayıyı yazın, örneğin `12`. **"Save"**.

**Göreceğiniz:** "… saved" ve yeni sayı.

İki mesaj kaydı durdurabilir; ikisi de bilerek:

- "The stock for this product is now 2, not 3. Reload the row and try again." (Bu ürünün stoğu artık 3 değil 2. Satırı yenileyip tekrar deneyin.) Eski bir sayıya göre yazdınız: sayfa açıldığından beri bir sipariş gönderildi ya da bir arkadaşınız kaydetti. Kart kendiliğinden güncel sayıyla yenilenir. Bakın, yeni sayıyı tekrar yazın, **"Save"**.
- "2 are set aside for orders that have not been sent yet …" (2 tanesi henüz gönderilmemiş siparişler için ayrılmış.) Müşteriler bunlardan 2 tane zaten almış. Stok bunun altına inemez. Önce o siparişleri gönderin ya da iptal edin.

**Söyleyin:** "Sayı ben bakmazken değiştiyse sayfa bana söylüyor ve kaydetmeden önce gerçek sayıyı gösteriyor. Böylece görmediğim bir satışı geri almış olmuyorum."

### Sahne 4 (2:30-3:00) Taslaklar ve ürünün geri kalanı

**Dokunun:** **"Drafts only"**.

**Göreceğiniz:** sadece sitede henüz olmayan ürünler, her birinde turuncu **"Draft"** (taslak) etiketi.

**Dokunun:** yayınlamak, fotoğrafı, adı, rengi ya da boyu değiştirmek için karttaki **"open the product"** (ürünü aç). ⚠ (Medusa'nın ürün sayfası: ⋯ menüsü → **"Edit"** → **"Status"** → **"Published"** → **"Save"**.)

---

## Ne ters gidebilir

| Ekranda | Anlamı ve yapılacak |
|---|---|
| "Price must be pounds and pence, like 4.99" | Nokta kullanın, en fazla iki ondalık, £ işareti yok. |
| "Stock must be a whole number, like 12" | Ondalık yok, eksi yok. |
| "The stock for this product is now …, not …. Reload the row and try again." | Sayfayı açtığınızdan beri sayı değişti. Kart yenilenir; sayıyı tekrar yazın. |
| "… are set aside for orders that have not been sent yet …" | Satılmış ama gönderilmemiş. Stok o sayının altına inemez. |
| "This product's stock is not tracked here, so its stock can't be changed from this page." | Bu ürün stok saymıyor (ürün sayfasında öyle ayarlanmış). Fiyatı yine de kaydedilir. |
| "… has more than one standard price …" | Ürüne Medusa'nın sayfasında iki perakende fiyat girilmiş. Ürünü açıp birini silin. |
| "Nothing matches …" | Yazımı kontrol edin ya da SKU ile arayın. |

## Unutmayın

- Fiyatlar KDV dahil ve sterlin.
- Yazdığınız stok sayısı eskisinin yerine geçer; üzerine eklenmez.
- Gönderilmemiş siparişler için ayrılmış stok düşürülemez.
- Yayınlama, fotoğraf, ad ve varyantlar: ürün sayfası.
