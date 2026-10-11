# Senaryo 9: Kargolu siparişler, "Packed & shipped"

- **Süre:** yaklaşık 3 dakika
- **Gerekenler:** bir deneme kargolu sipariş (sitede kargo seçeneğiyle, deneme kartıyla verilmiş) ve admin.technest.co.uk'a giriş yapılmış telefonunuz.
- **Nerede:** menü → **"Orders"** (Siparişler) → **"Delivery"** (Kargo) sekmesi (adres `/app/shop-orders?tab=delivery`). Aynı kartlar **"Today"** sayfasında "delivery orders to pack" altında da çıkar.
- **Durum:** 2026-10-11'de panel koduyla karşılaştırıldı.
- **Hedef:** paketi hazırlayın, kargocuya verin, tek düğmeye basın; müşteriye "yolda" e-postası gider, yazdıysanız takip numarasıyla birlikte.

---

### Sahne 1 (0:00-0:30) Delivery sekmesi

**Dokunun:** menü → **"Orders"** → **"Delivery"**.

**Göreceğiniz:** "Delivery orders" başlığı, "Pack the parcel, hand it to the carrier, then press Packed & shipped. Updates every minute." (Paketi hazırlayın, kargocuya verin, sonra Packed & shipped'e basın. Her dakika yenilenir.), bir **"Refresh"** ("Yenile") düğmesi ve iki düğme: **"To pack"** (hazırlanacak, yanında sayı) ve **"Shipped"** (kargoya verilen).

**Söyleyin:** "Kargolu siparişlerde para, sipariş verildiği anda karttan çekilir; ödeme için hiçbir şeye basmıyorum. Benim işim paketlemek ve paket çıkınca sisteme söylemek."

### Sahne 2 (0:30-1:15) Kartı okuyun

**Göreceğiniz:** en eskisi üstte kartlar. Her kartta **"Order #1043"**, "Placed 2 hours ago" (2 saat önce verildi), müşterinin adı ve posta kodu, ürünler ("2 x USB-C cable (1 m)"), **"Total £24.98 inc. VAT and delivery"** (KDV ve kargo dahil toplam) ve **"Packed & shipped"** düğmesi.

Bazı kartlarda etiket olur:

- **"Payment not taken"** (kırmızı; ödeme alınmadı): karttan para henüz çekilmedi. Düğme kapalı, nedeni kartta yazıyor. Paketi göndermeyin. Sistem ödemeyi kendiliğinden tekrar dener; bir saat sonra etiket hâlâ duruyorsa siparişi açıp ödemeyi oradan alın ya da müşteriyi arayın.
- **"Refunded"** (gri; iade edildi): paranın tamamı geri gitti. Gönderilecek bir şey yok.
- **"Part of this order has left"** (siparişin bir kısmı çıktı): bazı ürünler daha önce gönderilmiş (Medusa'nın sipariş sayfasından). Düğme kalanını gönderir.

**Söyleyin:** "En eski en üstte. Kırmızı etiket para gelmedi demek: o bekler."

### Sahne 3 (1:15-2:15) Paketleyin ve düğmeye basın

**Dokunun:** paketi hazırlayın. Kargocuya verin. Sonra **"Packed & shipped"**.

**Göreceğiniz:** "Mark order #1043 as shipped?" (sipariş kargoya verildi olarak işaretlensin mi?) kutusu, "Only press this once the parcel is with the carrier…" (sadece paket kargocudayken basın) uyarısı, iki isteğe bağlı alan: **"Tracking number (optional)"** (takip numarası) ve **"Tracking link (optional)"** (takip bağlantısı), ve **"Not yet"** (henüz değil) ile **"Yes, it's shipped"** (evet, gönderildi) düğmeleri.

**Dokunun:** varsa kargocunun takip numarasını yazın (harf, rakam, boşluk ve tire), kargocu verdiyse takip bağlantısını yapıştırın (`https://` ile başlamalı), sonra **"Yes, it's shipped"**.

**Göreceğiniz:** "Order #1043 is on its way. The customer has been emailed." (sipariş yolda, müşteriye e-posta gönderildi). Kart **"Shipped"**e geçer, üzerinde yeşil "Shipped …" etiketi.

**Söyleyin:** "Müşteriye hemen 'siparişiniz yolda' e-postası gider; yazdıysam takip numarası ve bağlantısıyla. Yanlışlıkla iki kez bassam ikincisinde hiçbir şey olmaz: bir paket, bir e-posta."

### Sahne 4 (2:15-3:00) Siparişle ilgili diğer işler

**Dokunun:** kartın altındaki **"open the order"** (siparişi aç).

**Söyleyin:** "Adres değişikliği, iade, iptal: hepsi sipariş sayfasında, senaryo 8. Delivery sekmesi sadece paketlemek ve göndermek için."

---

## Ne ters gidebilir

| Ekranda | Anlamı ve yapılacak |
|---|---|
| **"Payment not taken"** etiketi; düğme kapalı; "The payment hasn't been taken yet, so this can't be sent…" | Karttan para çekilmedi. Bekleyin (sistem tekrar dener) ya da siparişi açıp ödemeyi oradan alın. Paketi göndermeyin. |
| **"Refunded"** etiketi; düğme kapalı | Tamamı iade edildi. Gönderilecek bir şey yok. Yanlışsa siparişi açın. |
| "Order … is being updated. Refresh in a moment." | Aynı siparişle şu an biri (ya da ödeme) uğraşıyor. Birkaç saniye bekleyip **"Refresh"**e basın. |
| "A tracking number has only letters, numbers, spaces and dashes (up to 64)." | Numarayı kontrol edin; başka karakterleri silin. |
| "The tracking link must start with https:// and be under 500 characters." | Kargocunun verdiği bağlantının tamamını yapıştırın ya da bağlantıyı boş bırakıp sadece numarayı yazın. |
| "Add the tracking number as well, or clear the link." | Tek başına bağlantı yetmez; numara da gerekir. |
| "… is a Click & Collect order. Use the Collect tab." | Yanlış sekme: o sipariş dükkandan teslim alınacak (senaryo 3). |
| Bastıktan sonra kart hâlâ **"To pack"**te | **"Refresh"**e basın. Hâlâ oradaysa düğmenin üstündeki mesaj nedenini söyler. |

## Unutmayın

- **"Packed & shipped"**e ancak paket kargocudayken basın. E-posta hemen gider, geri alınamaz.
- **"Payment not taken"** yazan siparişi asla göndermeyin.
- Takip numarası isteğe bağlı; ama varsa yazın, bir "siparişim nerede?" telefonunu kurtarır.
- İade, iptal ve adres değişikliği: sipariş sayfası (senaryo 8), Stripe'tan asla.
