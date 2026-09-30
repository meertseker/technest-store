# Senaryo 4: Cihazlar ve "Fits these devices" (Uyumlu cihazlar)

- **Süre:** yaklaşık 5 dakika
- **Gerekenler:** admin.technest.co.uk'a giriş yapılmış telefon veya bilgisayar; bir deneme ürünü (ör. telefon kılıfı); ekleyip sonra sileceğiniz uydurma bir deneme cihazı.
- **Nerede:** menü → **"Devices"** (Cihazlar, adres `/app/devices`) ve her ürün sayfasındaki **"Fits these devices"** kutusu.
- **Durum:** 2026-09-30'da bitmiş panel koduyla karşılaştırıldı.

---

### Sahne 1 (0:00-0:30) Cihazlar neden önemli

**Dokunun:** siteyi açın, cihaz seçiciden bir telefon seçin.

**Söyleyin:** "Müşteri telefonunu ya da konsolunu bir kez seçiyor, sonra sadece ona uyan ürünleri görüyor. Bunun çalışması için iki liste doğru olmalı: cihaz listesi ve her ürüne bağlı cihazlar."

### Sahne 2 (0:30-1:15) Devices sayfası

**Dokunun:** menü → **"Devices"**.

**Göreceğiniz:** "Devices" başlığı ve **"Add device"** ("Cihaz ekle") düğmesi, bir **"Search"** (arama) kutusu ("Model, web address name or model number"; model, web adı ya da model numarası), ve **"All"** (hepsi), **"Phone"** (telefon), **"Tablet"**, **"Games console"** (oyun konsolu), **"Laptop"** düğmeleri. Her satırda model (ör. "iPhone 16 Pro"), altında "Apple · iPhone 16 · 2024" ve diğer adlar için "Also: 16 pro, A3102".

**Dokunun:** aramaya "a3102" yazıp model numarasıyla da bulunduğunu gösterin.

### Sahne 3 (1:15-2:30) Cihaz ekleyin

**Dokunun:** **"Add device"**.

**Göreceğiniz:** "Add a device" penceresi ve alanlar: **"Brand"** (marka), **"Series"** (seri), **"Model"**, **"Kind of device"** (cihaz türü), **"Other names (optional)"** (diğer adlar), **"Year released (optional)"** (çıkış yılı), **"Web address name (optional)"** (web adı), **"Picture web address (optional)"** (resim adresi).

**Dokunun:** Brand `Apple`, Series `iPhone 16`, Model `iPhone 16 Pro`, Kind `Phone`, Other names `16 pro, A3102`, Year `2024`. Web adını boş bırakın. **"Add device"**a basın.

**Göreceğiniz:** "iPhone 16 Pro added." (eklendi)

**Söyleyin:** "Model adını üreticinin yazdığı gibi yazıyorum. Diğer adlara müşterinin yazabileceği şeyleri, virgülle ayırarak, kutudaki model numarasıyla birlikte yazıyorum. Web adını sistem kendisi oluşturuyor."

### Sahne 4 (2:30-3:15) Düzenleme ya da silme

**Dokunun:** listedeki cihaza.

**Göreceğiniz:** "Edit iPhone 16 Pro", aynı alanlar, **"Products that fit"** (uyan ürünler) listesi ve en altta **"Delete device"** ("Cihazı sil").

**Dokunun:** bir diğer adı değiştirip **"Save"** ("… saved."). Sonra, sadece deneme cihazı için: **"Delete device"** → "Delete …? It is linked to 3 products. Those links are removed too. This can't be undone." (3 ürüne bağlı; bu bağlantılar da silinir; geri alınamaz) → **"Delete"**.

**Söyleyin:** "Bir cihazı silmek onu tüm ürünlerden de kaldırır. Sadece yanlışlıkla eklediğim bir cihazı silerim. Gerçek bir cihazın web adını da değiştirmem; eski bağlantılar çalışmaz olur."

### Sahne 5 (3:15-4:30) Üründe "Fits these devices"

**Dokunun:** **"Products"** → deneme kılıfını açın → **"Fits these devices"** kutusunu bulun (bilgisayarda sağ sütunda).

**Göreceğiniz:** bağlı cihazlar, her birinin yanında **"Remove"** ("Kaldır") düğmesi; ya da "No devices linked. Customers won't see this product when they pick a device." (Bağlı cihaz yok; müşteri cihaz seçince bu ürünü görmez.)

**Dokunun:** **"Add"** ("Ekle"). "Link devices to …" penceresinde "16" arayın, **iPhone 16** ve **iPhone 16 Plus**'ı işaretleyin. **"Note for customers (optional)"** (müşteri notu) alanına "Not compatible with MagSafe" yazın. **"Link 2 devices"** ("2 cihazı bağla").

**Göreceğiniz:** "2 devices linked." İkisi de notuyla birlikte kutuda görünür.

**Dokunun:** birinin yanındaki **"Remove"** ("… removed.").

**Söyleyin:** "Not, o seferde işaretlediğim tüm cihazlara yazılır ve müşteri onu cihazın yanında görür. Zaten bağlı bir cihazı tekrar işaretlersem notu değişir. Uyduğundan emin değilsem işaretlemem: yanlış uyum iade demektir."

### Sahne 6 (4:30-5:00) Toparlama

**Söyleyin:** "Yeni telefon çıkınca Devices'a model numarasıyla eklerim. Her üründe sadece gerçekten uyanları bağlarım. Quick add de cihaz önerdiği için çoğu zaman bu iş zaten yapılmış olur."

---

## Ne ters gidebilir

| Gördüğünüz | Anlamı / ne yapmalı |
|---|---|
| "A device with slug iphone-16-pro already exists" | Bu cihaz zaten var. Önce arayın. |
| "Use lowercase letters, numbers and dashes only…" | **"Web address name"** alanını boş bırakın; kendiliğinden oluşur. |
| "No devices match. Add new ones under Devices." (ürün kutusunda) | Cihaz listede yok. Önce Devices sayfasından ekleyin. |
| Müşteri telefonunu bulamıyor | Yazdığı kelimeyi (çoğunlukla model numarası) **"Other names"**e ekleyin. |
| Ürün bir telefonda görünmüyor | Üründe **"Fits these devices"**e ve ürünün yayında olup olmadığına bakın. |
| Bir cihazı yanlışlıkla sildiniz | Tekrar ekleyin ve her üründe yeniden bağlayın. Bağlantılar kendiliğinden geri gelmez. |

## Unutmayın

- Ürüne sadece gerçekten uyan cihazları bağlayın.
- **"Model"**e üreticinin model adı; diğer adlar ve model numaraları **"Other names"**e.
- Bir cihazı silmek onu tüm ürünlerden kaldırır.
