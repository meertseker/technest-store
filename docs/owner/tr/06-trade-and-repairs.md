# Senaryo 6: Toptan (trade) başvuruları ve tamir randevuları

- **Süre:** yaklaşık 5 dakika
- **Gerekenler:** admin.technest.co.uk'a giriş yapılmış telefonunuz; iki **deneme** trade başvurusu (sitedeki trade formundan iki deneme müşteri hesabıyla gönderin) ve bir **deneme** tamir randevusu (sitedeki tamir formundan kendi telefon numaranızla gönderin).
- **Nerede:** menü → **"Trade applications"** (`/app/trade-applications`) ve **"Repair bookings"** (`/app/repair-bookings`).
- **Durum:** 2026-09-30'da bitmiş panel koduyla karşılaştırıldı. ⚠ işaretli adımlar Medusa'nın kendi ekranlarıdır.

---

## A Bölümü: Trade başvuruları (0:00-2:30)

### Sahne 1 (0:00-0:30) Liste

**Dokunun:** menü → **"Trade applications"**.

**Göreceğiniz:** "Businesses asking for trade prices…" (toptan fiyat isteyen işletmeler) açıklaması ve **"Waiting"** (bekleyen), **"Approved"** (onaylanan), **"Rejected"** (reddedilen), **"All"** (hepsi) düğmeleri. **"Waiting"** açık, en eskisi üstte.

**Söyleyin:** "Başka tamirciler gibi işletmeler sitede trade hesabı için başvuruyor. Her biri için bana e-posta da geliyor. Onayladığımda, giriş yaptıklarında KDV hariç toptan fiyatları görüyorlar."

### Sahne 2 (0:30-1:15) Başvuruyu kontrol edin

**Dokunun:** ilk başvuruyu açın.

**Göreceğiniz:** şirket adı, **"Waiting for review"** (inceleme bekliyor) etiketi ve **"Business type"** (işletme türü), **"VAT number"** (KDV numarası), **"Companies House number"** (şirket sicil numarası), **"Contact"** (yetkili), **"Phone"**, **"Email"**, **"Customer account"** (müşteri hesabı).

**Söyleyin:** "Gerçek bir işletme mi diye bakıyorum. Companies House numarasını devletin sitesinde arayabilirim."

### Sahne 3 (1:15-1:45) Onaylayın

**Dokunun:** **"Approve"** ("Onayla") → "Approve …? They will see trade prices when they log in, and we'll email them to say so." (giriş yapınca toptan fiyatları görecekler, onlara e-posta gidecek) → **"Approve"**.

**Göreceğiniz:** "… approved." ve "Approved. This customer sees trade prices when logged in."

### Sahne 4 (1:45-2:30) Gerekçeyle reddedin

**Dokunun:** ikinci başvuruyu açın → **"Reject"** ("Reddet").

**Göreceğiniz:** "Reject …" penceresinde bir **"Reason"** (gerekçe) kutusu ve "The customer sees this in their email…" (müşteri bunu e-postasında görür) notu.

**Dokunun:** yazın: "We couldn't find your company on Companies House. Please check the number and apply again." → **"Reject and email"** ("Reddet ve e-posta gönder").

**Göreceğiniz:** "… rejected." ve "Rejected. The customer can send a new application." (müşteri yeniden başvurabilir)

**Söyleyin:** "Gerekçe müşteriye İngilizce e-postayla gidiyor; kibar ve açık yazıyorum, ne yapması gerektiğini söylüyorum."

## B Bölümü: Tamir randevuları (2:30-4:30)

### Sahne 5 (2:30-3:00) Liste

**Dokunun:** menü → **"Repair bookings"**.

**Göreceğiniz:** "Repair requests from the website. Call the customer back, then mark it booked in." (siteden gelen tamir talepleri; müşteriyi geri arayın, sonra randevu verildi işaretleyin) ve **"To call back"** (geri aranacak), **"Booked in"** (randevu verildi), **"Done"** (bitti), **"All"** düğmeleri. **"To call back"** açık, en uzun bekleyen üstte. Liste her dakika yenilenir.

### Sahne 6 (3:00-4:00) Arayın ve randevu verin

**Dokunun:** deneme randevusunu açın.

**Göreceğiniz:** başlıkta cihaz, "Sent … (2 hours ago)", **"Name"** (ad), **"Phone"**, **"Email"**, **"Device"** (cihaz), **"What's wrong"** (arıza), **"Best time to call"** (aranmak için uygun saat), sonra üç büyük düğmeli **"Status"** (durum: **"To call back"**, **"Booked in"**, **"Done"**) ve **"Staff notes"** (personel notları).

**Dokunun:** telefon numarasına: telefonunuz aramayı başlatır. Fiyat ve saat konusunda anlaşın. Panele dönüp **"Staff notes"**a "Ekran £89, Cmt 11:00" yazın, **"Save notes"** ("Notes saved."). Sonra **"Booked in"** ("Marked as booked in.").

**Söyleyin:** "Notları sadece personel görür, müşteri asla görmez."

### Sahne 7 (4:00-4:30) Bitti

**Dokunun:** tamir bitip cihaz teslim edilince **"Done"**. Yanlışlıkla bastıysanız tekrar **"Booked in"**e basın.

### Sahne 8 (4:30-5:00) Toparlama

**Söyleyin:** "İki listeye de her gün bakarım. Gerçek işletmeleri onaylarım; reddederken her zaman açık bir gerekçe yazarım. Tamir müşterilerini mümkünse aynı gün ararım."

---

## Ne ters gidebilir

| Gördüğünüz | Anlamı / ne yapmalı |
|---|---|
| Reddetme gitmiyor | Gerekçe boş. Bir gerekçe yazın. |
| Onay ya da ret reddedildi | Başka biri zaten onayladı ya da reddetti. Sayfayı yenileyin. |
| Yanlış işletmeyi onayladınız | Geri alma düğmesi yok. Müşteriyi **"Trade"** müşteri grubundan çıkarın (menü → **"Customers"** → müşteri → gruplar) ⚠, sonra lead'e haber verin. |
| Onaylı trade müşterisi toptan fiyat görmüyor | Toptan fiyat sadece **"Trade"** fiyat listesinde fiyatı olan ürünlerde var (menü → **"Pricing"**) ⚠. Oraya fiyatlar **sterlin ve KDV dahil** girilir; site KDV hariç gösterir. [LEAD?] bu fiyatları kim girecek |
| Bilgisayarda numaraya dokununca arama başlamıyor | Telefonunuzu kullanın ya da numarayı elle çevirin. |
| Müşteri "kimse aramadı" diyor | **"To call back"**e bakın. Aradığınız herkesi **"Booked in"**e taşıyın. |
| Hiç tamir randevusu gelmiyor | Sitedeki form robot kontrolü (Cloudflare Turnstile) yapar. Sunucuda kurulu değilse her randevu reddedilir. Lead'e haber verin. |

## Unutmayın

- Onaylamak bir dokunuş ve bir onaydır. Reddetmek her zaman gerekçe ister ve gerekçe müşteriye e-postayla gider.
- Trade müşterileri fiyatları KDV hariç, açıkça etiketlenmiş görür.
- Tamir randevuları: To call back → Booked in → Done. Notlar sadece personel için.
- Müşterinin telefon numarasını ya da e-postasını dükkan dışında kimseyle paylaşmayın.
