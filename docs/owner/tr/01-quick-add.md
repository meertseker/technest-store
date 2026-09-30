# Senaryo 1: "Quick add" (Hızlı ekle), fotoğraftan yeni ürün

- **Süre:** yaklaşık 5 dakika
- **Gerekenler:** admin.technest.co.uk'a giriş yapılmış telefonunuz; paketinde gerçek bir aksesuar (üzerindeki güvenlik işaretini gösterebilmek için en iyisi bir şarj aleti); düz, açık renkli bir zemin; iyi ışık. Deneme ürününü sonra silebilirsiniz.
- **Nerede:** menü → **"Quick add"** (adres `/app/quick-add`).
- **Durum:** 2026-09-30'da bitmiş panel koduyla karşılaştırıldı. ⚠ işaretli adımlar Medusa'nın kendi ürün sayfasını kullanır: kayıttan önce canlı panelde bir kez bakın.
- **Hedef:** fotoğraftan taslak ürüne yaklaşık bir dakika, sonra ürün sayfasından yayınlamak.

---

### Sahne 1 (0:00-0:30) Quick add ne yapar

**Dokunun:** sol üstteki menü düğmesi, sonra **"Quick add"**.

**Göreceğiniz:** "Quick add" başlığı, büyük bir **"Take photo"** ("Fotoğraf çek") düğmesi, **"Choose a photo"** ("Fotoğraf seç") ve **"Add without a photo"** ("Fotoğrafsız ekle").

**Söyleyin:** "Burası Quick add. Ürünün tek bir fotoğrafını çekiyorum. Sistem fotoğrafı okuyup başlığı, kategoriyi, uyduğu telefonları ve güvenlik işaretini öneriyor. Ben hepsini kontrol ediyorum, fiyatı yazıyorum ve taslak olarak kaydediyorum. Ben yayınlamadıkça sitede hiçbir şey görünmez."

### Sahne 2 (0:30-1:00) Fotoğrafı çekin

**Dokunun:** **"Take photo"**. Kamera açılır. Ürünü düz zemine, etiketi size bakacak şekilde koyun ve çekin.

**Göreceğiniz:** üstte fotoğrafınız ve mavi bir kutu: "Reading the photo… this takes up to half a minute. You can start typing meanwhile." (Fotoğraf okunuyor, yarım dakika kadar sürer; bu arada yazmaya başlayabilirsiniz.)

**Söyleyin:** "Ürünün tamamı karede olsun, etiket okunsun, arka plan sade olsun. Fotoğraf olduğu gibi yükleniyor ve bu orijinal her zaman saklanıyor."

### Sahne 3 (1:00-2:00) Öneriyi kontrol edin

**Göreceğiniz:** mor **"AI suggestion"** (yapay zekâ önerisi) etiketi, bir **"Confidence"** (güven: high/medium/low, yani yüksek/orta/düşük) etiketi, "Check every field. The AI can be wrong…" (Her alanı kontrol edin, yapay zekâ yanılabilir) cümlesi, belki turuncu uyarılar, ve dolu alanlar: **"Title"** (başlık), **"Description"** (açıklama), **"Category"** (kategori), **"Product type"** (ürün türü), **"Fits these devices"** (uyumlu cihazlar).

**Dokunun:** başlıkta bir kelimeyi düzeltin. **"Fits these devices"** bölümünde yanlış bir telefona dokunup kaldırın (yanında ✕ var) ya da aramaya "16 pro" yazıp **"+ Apple iPhone 16 Pro"** ile ekleyin.

**Söyleyin:** "Bunlar sadece öneri. Güven düşükse her şeyi iki kez okurum. Kategori, ürünün sitede nerede çıkacağını belirler. Cihazlar da telefonunu seçen müşterinin ürünü görüp görmeyeceğini belirler; o yüzden sadece gerçekten uyan telefonları bırakırım."

### Sahne 4 (2:00-2:45) Fiyat ve güvenlik işareti

**Göreceğiniz:** **"Price (£, incl. VAT)"** (KDV dahil fiyat, £) boş. Altında "Suggested: £14.99 (an AI guess, not a rule)" (önerilen fiyat, sadece tahmin) ve **"Use £14.99"** ("£14.99'u kullan") düğmesi.

**Dokunun:** fiyatınızı yazın, örneğin `12.99` (katılıyorsanız **"Use £…"**a da basabilirsiniz). **"Safety marking"** (güvenlik işareti) bölümünde "AI saw: …" (yapay zekânın gördüğü) satırını okuyun, sonra kutuya kendiniz bakın. **"UKCA"**, **"CE"** veya **"No mark"** (işaret yok) seçin. UKCA ya da CE seçtiyseniz **"I have checked the label: it shows the UKCA mark"** (etiketi kontrol ettim, UKCA işareti var) kutusunu işaretleyin.

**Söyleyin:** "Fiyat benim yerime asla doldurulmaz. Sterlin olarak, KDV dahil yazarım. Güvenlik işaretini sistem sadece tahmin eder; gerçek etikete bakıp kutuyu ben işaretlerim. UKCA veya CE'si olmayan şarj aletleri ve powerbank'ler taslak olarak kaydedilebilir ama yayınlanamaz."

### Sahne 5 (2:45-3:15) Stok ve SKU

**Dokunun:** **"More details (SKU, stock, connectors)"** (diğer bilgiler) bölümünü açın. **"Stock in the shop"** (dükkandaki stok) alanını girin (1'den başlar). Kullanıyorsanız **"SKU"** (stok kodu) yazın. Konnektör ve watt isteğe bağlı.

**Dokunun:** **"Save as draft"** ("Taslak olarak kaydet").

**Göreceğiniz:** "… saved as a draft" (taslak olarak kaydedildi) mesajı.

### Sahne 6 (3:15-4:00) Temiz fotoğraf

**Göreceğiniz:** "Saved as a draft. Now the photo…", bir yanda orijinaliniz, diğer yanda "Cleaning up the background…" (arka plan temizleniyor), sonra beyaz arka planlı fotoğraf (genelde 5-15 saniye).

**Dokunun:** temiz fotoğrafta ürünün kenarlarına bakın. Doğruysa **"Use this photo"** ("Bu fotoğrafı kullan"). Değilse **"Skip for now"** ("Şimdilik geç"); bunu sonra ürün sayfasında yapabilirsiniz (senaryo 2).

**Söyleyin:** "Sadece arka plan değişir. Ürün asla çizilmez ya da değiştirilmez, orijinalim de saklanır."

### Sahne 7 (4:00-4:45) Yayınlama ⚠

**Göreceğiniz:** "… is saved as a draft. Check it on the product page, then publish it there when it is ready." (Taslak kaydedildi; ürün sayfasında kontrol edip oradan yayınlayın.) ve iki düğme: **"Open product"** ("Ürünü aç") ve **"Add another product"** ("Başka ürün ekle").

**Dokunun:** **"Open product"**. Ürün sayfasında üstteki menüyü (⋯) açın, **"Edit"** ("Düzenle"), **"Status"** (durum) alanını **"Published"** (yayında) yapın ve **"Save"** ("Kaydet"). ⚠

**Söyleyin:** "Artık sitede. Güvenlik işareti olmayan bir şarj aletiyse yayınlama reddedilir ve nedeni yazılır."

### Sahne 8 (4:45-5:00) Toparlama

**Söyleyin:** "Fotoğraf, öneriyi kontrol, fiyat, güvenlik işareti, stok, kaydet. Sonra fotoğraf, sonra yayınla. Ürün başına bir dakika kadar."

---

## Ne ters gidebilir

| Gördüğünüz | Anlamı / ne yapmalı |
|---|---|
| "AI suggestions are switched off (ANTHROPIC_API_KEY is not set)…" | Sunucuda yapay zekâ anahtarı girilmemiş. Bilgileri kendiniz yazın, lead'e haber verin. |
| Fotoğraftan sonra turuncu bir kutu (ör. "too many requests", "busy", "timed out") | Yapay zekâ cevap vermedi. Form yerinde kalır. Bilgileri kendiniz yazın ya da sonra tekrar deneyin. Kişi başına saatte yaklaşık 60 fotoğraf okunabilir. |
| "This looks like a vape product. Vapes are never sold online, so it can't be added." | Doğru: vape internetten asla satılmaz. |
| "Enter the selling price in pounds, e.g. 12.99." / "Use at most 2 decimals…" | Peni değil sterlin yazın: `1299` değil `12.99`. |
| "Check the UKCA mark on the label, then tick the box." | UKCA/CE seçtiniz ama kutuyu işaretlemediniz. |
| "This photo is larger than 25 MB…" | Kamera çözünürlüğünü düşürün ya da daha küçük bir fotoğraf seçin. |
| "Photo too small, please retake closer" / "The product is too small in the photo…" | Yaklaşıp tekrar çekin. |
| "No product found in the photo, please retake it against a plain background" | Sade, açık renkli bir zemin kullanın. |
| Ürün kaydedildi ama temiz fotoğraf başarısız | Ürün taslak olarak güvende. **"Try again"** ("Tekrar dene") ya da **"Skip for now"** deyip fotoğrafı sonra ürün sayfasında yapın. |
| Şarj aleti yayınlanmıyor: "… needs a safety marking (UKCA or CE) before it can be published…" | Kutudaki işarete bakın. CSV içe aktarmayla düzeltin (senaryo 7), sonra yayınlayın. |
| SKU reddedildi | Bu stok kodu başka bir üründe kullanılıyor. |

## Unutmayın

- Quick add her zaman **taslak** kaydeder. Yayınlamayı ürün sayfasında yaparsınız.
- Fiyatlar sterlin ve KDV dahil. Önerilen fiyat sadece tahmin.
- Güvenlik işaretini etikete bakarak siz onaylarsınız. Şarj ve güç ürünleri UKCA veya CE olmadan yayınlanamaz.
- Vape internetten asla satılmaz.
- Quick add'de "£1 ek ürün" (add-on) seçeneği yok. Bunu CSV içe aktarmayla ayarlarsınız (senaryo 7). [LEAD?]
