# Günlük rutin ve ilk hafta

Dükkan saatleri: Pzt-Cmt 09:00-20:00, Paz 11:00-17:00. Dükkan e-postaları **hello@technest.co.uk** adresine gelir.
Panel **admin.technest.co.uk** adresinde. Telefonda menü düğmesi sol üstte.

Menüde dört sayfa var: **"Today"** (bugün yapılacaklar; panel burada açılır), **"Orders"** (sekmeler: **"Collect"**,
**"Delivery"**, **"Repairs"**, **"Trade"**), **"Products"** (sekmeler: **"Add"**, **"Price & stock"**, **"Import"**) ve
**"Shop settings"** (sekmeler: **"Delivery & Klarna"**, **"Devices"**).

## Her gün

### Sabah (açılıştan önce)

1. **Düşük stok e-postasını okuyun** (08:00 civarı gelir, konu "Low stock: … items to reorder").
   Her satırda ürün ve "3 left (min 3)" (3 kaldı, en az 3) yazar. Click & Collect rafında bekleyen
   ürünler zaten gitmiş sayılır. Gerekenleri sipariş edin. **E-posta yoksa azalan bir şey yok demektir.**
2. **"Orders" → "Collect"** (senaryo 3). **"To pick"**i açın, en eskiden başlayın. Her siparişi
   hazırlayıp **"Mark ready"**e basın. Müşteriye teslim kodunu içeren e-posta gider.
3. **"Orders" → "Delivery"** (senaryo 9). **"To pick"** gibi **"To pack"**teki her siparişi paketleyin, kargocuya
   verin, **"Packed & shipped"**e basın, varsa takip numarasını yazın; müşteriye "yolda" e-postası gider.
   Kırmızı **"Payment not taken"** (ödeme alınmadı) etiketi olan bekler.
4. **"Orders" → "Repairs"** → **"To call back"** (senaryo 6). Geceden gelen var mı? Aramaları planlayın.
5. **"Orders" → "Trade"** → **"Waiting"** (senaryo 6). Onaylayın ya da reddedin.

### Gün içinde

- Tezgahta Click & Collect müşterisi: **teslim kodunu kontrol edin**, poşeti verin, **"Collected"** →
  **"Yes, collected"**e basın. Karttan para ancak o anda çekilir.
- Tamir müşterilerini geri arayın. Not yazıp **"Booked in"**e basın. Tamir bitince **"Done"**.
- Yeni mal mı geldi? Tek ürün için **"Products" → "Add"** (senaryo 1), çok ürün için **"Products" → "Import"** (senaryo 7).
- Fiyat ya da stok sayısı mı değişti? **"Products" → "Price & stock"** (senaryo 10).
- İade mi? Sadece paneldeki sipariş sayfasından (senaryo 8). Stripe'tan asla.

### Akşam (kapanıştan önce)

1. **"Orders" → "Collect"**: **"To pick"**te bir şey kaldı mı? Hazırlayın. **"Ready"**de "Reminder sent"
   (hatırlatma gitti) yazan var mı? Hazır olduktan 7 gün sonra iptal olacak; müşteriyi arayabilirsiniz.
   İptal olan siparişlerin ürünlerini rafa geri koyun.
2. **"Orders" → "Delivery"**: **"To pack"**te bir şey kalmasın (**"Payment not taken"** etiketli kartlar hariç).
3. Aradığınız her tamir müşterisi **"To call back"**ten çıkmış olsun.

## Canlıya geçişten sonraki ilk hafta: kontrol listesi

**1. gün**
- [ ] Telefonunuzdan ve dükkandaki bilgisayardan giriş yapın. Yukarıdaki sayfaların hepsini menüde bulun.
- [ ] hello@technest.co.uk'a e-postaların geldiğini kontrol edin: yeni sipariş, yeni trade başvurusu, yeni tamir randevusu. Biri gelmiyorsa lead'e haber verin.
- [ ] Sitede henüz olmayan stoğu **"Products" → "Import"** ile yükleyin (senaryo 7): şablonu indirin, doldurun, önizlemeye bakın, **"Problems"**i düzeltin, sonra **"Import"**.

**2. gün**
- [ ] İçe aktarmadaki **"Draft"** satırlarına bakın. Şarj ve güç ürünleri UKCA veya CE ister: kutuya bakın, `safety_marking`i doldurun, `published` olarak tekrar yükleyin.
- [ ] Senaryo 1'i izleyin. **"Products" → "Add"** ile 5 yeni ürün ekleyip yayınlayın. Her biri için bir dakika civarı hedefleyin.

**3. gün**
- [ ] **"Shop settings" → "Devices"**: en yeni telefonlar, model numaraları **"Other names"**de olacak şekilde listede mi?
- [ ] En çok satan 20 ürününüzde **"Fits these devices"**i kontrol edin.
- [ ] Fotoğrafı kötü olan çok satanlarda **"Product photo"** kutusunu kullanın (senaryo 2).

**4. gün**
- [ ] **"Shop settings" → "Delivery & Klarna"**: ücretsiz Standart kargo £20'den, Klarna £30'dan itibaren.
- [ ] Hızlı satanlarda (kablo, şarj aleti, ekran koruyucu) yeniden sipariş seviyesini küçük bir CSV ile yükseltin: `sku,reorder_level`.
- [ ] £1'lık ek ürünler: £1 Deals kategorisinde **ve** `is_addon_item` yes olsun. Medusa'nın Promotions sayfasında (adres çubuğuna `/app/promotions` yazın) `ADDONS-3-FOR-2` etkin mi, bakın.

**5. gün**
- [ ] Senaryo 3'ü izleyin. Her Click & Collect siparişini panodan yürütün: To pick → Mark ready → kodu kontrol → Collected.
- [ ] Teslim edilmiş bir siparişi açın (**"Orders" → "All orders"**): ödeme çekilmiş (paid/captured) görünmeli.

**6. gün**
- [ ] Senaryo 6'yı izleyin. **"Orders" → "Trade" → "Waiting"** ve **"Orders" → "Repairs" → "To call back"** listelerini boşaltın.
- [ ] Düşük stok e-postası işe yarıyor mu? Çok mu uzun, çok mu kısa? Seviyeleri ayarlayın.

**7. gün**
- [ ] **"Ready"**de "Reminder sent" yazan Click & Collect siparişi var mı? Müşteriyi arayın.
- [ ] Senaryo 9 ve 10'u izleyin. Bir deneme kargolu siparişini takip numarasıyla gönderin; **"Price & stock"**ta bir fiyat değiştirin.
- [ ] Senaryo 8'i izleyin. Deneme siparişinde sipariş sayfasından bir deneme iadesi yapın.
- [ ] Yavaş ya da kafa karıştırıcı gelen her şeyi not edip lead'e gönderin.

## Unutmayın

- Vape internetten asla satılmaz. Şarj aletleri ve powerbank'ler yayından önce UKCA veya CE ister.
- Fotoğraflar: sadece arka plan değişir, orijinal her zaman saklanır.
- Fiyatlar sterlin ve KDV dahil.
- £1'lık ek ürünler tek başına kargolu sipariş olamaz. Click & Collect olur.
- Click & Collect'te para **"Collected"**da çekilir; kargoda kendiliğinden çekilir.
- İade sadece panelden, Stripe'tan asla.
