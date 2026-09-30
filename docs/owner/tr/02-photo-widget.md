# Senaryo 2: Ürün sayfasındaki "Product photo" (Ürün fotoğrafı) kutusu

- **Süre:** yaklaşık 4 dakika
- **Gerekenler:** admin.technest.co.uk'a giriş yapılmış telefon veya bilgisayar; bir deneme ürünü; fotoğrafını çekebilmek için ürünün kendisi.
- **Nerede:** menü → **"Products"** (Ürünler) → bir ürün → **"Product photo"** kutusu. (Kutunun sayfadaki yeri panelin düzen editöründen değiştirilebilir; biraz yukarıda ya da aşağıda olabilir.)
- **Durum:** 2026-09-30'da bitmiş panel koduyla karşılaştırıldı. ⚠ işaretli adımlar Medusa'nın kendi ekranlarıdır.

---

### Sahne 1 (0:00-0:30) Kutu ne işe yarar

**Dokunun:** **"Products"**, deneme ürününü açın, **"Product photo"** kutusuna inin.

**Göreceğiniz:** iki kare: **"Original (always kept)"** (orijinal, her zaman saklanır) ve **"White background (only the background changes)"** (beyaz arka plan, sadece arka plan değişir). Sağ üstte bir etiket: **"No photo"** (fotoğraf yok), **"Not processed"** (işlenmedi), **"Waiting for approval"** (onay bekliyor) veya **"Approved"** (onaylandı).

**Söyleyin:** "Her ürünün bu fotoğraf kutusu var. Mevcut bir ürüne temiz beyaz fotoğraf vermek ya da Quick add'de yarım kalan fotoğrafı bitirmek için kullanıyorum."

### Sahne 2 (0:30-1:15) Quick add'den yarım kalan fotoğraf

**Göreceğiniz:** Quick add'de "Skip for now" dediyseniz etiket **"Not processed"** yazar ve bir **"Process"** ("İşle") düğmesi vardır.

**Dokunun:** **"Process"**. Bekleyin (genelde 5-15 saniye, "Working on it…").

**Göreceğiniz:** temiz fotoğraf çıkar. Etiket **"Waiting for approval"** olur.

### Sahne 3 (1:15-2:00) Yeni fotoğraf

**Dokunun:** **"Add photo"** ("Fotoğraf ekle"; üründe zaten fotoğraf varsa **"New photo"**, "Yeni fotoğraf"). Telefonda kamera açılır. Fotoğrafı çekin.

**Göreceğiniz:** "Uploading the photo…" (yükleniyor), sonra "Working on it…", sonra iki fotoğraf yan yana.

### Sahne 4 (2:00-3:00) Kontrol edin, sonra onaylayın ya da vazgeçin

**Dokunun:** temiz fotoğrafı yakınlaştırın. Kenarlara bakın: kablo uçları, köşeler, askılar, şeffaf plastik.

**Söyleyin:** "Ürünün bir parçası eksik mi? Renk doğru mu? Sistem sadece arka planı değiştirir. Ürünün bir kısmı kesilmişse onaylamam."

**Dokunun:** doğruysa **"Approve"** ("Onayla").

**Göreceğiniz:** "Photo approved: it is now the main image" (fotoğraf onaylandı, artık ana görsel). Etiket **"Approved"** olur. Temiz fotoğraf artık ana fotoğraf ve listelerdeki küçük resim. Eski fotoğraflar üründe, yenisinin arkasında kalır.

**Dokunun (diğer durum):** yanlışsa **"Discard"** ("Vazgeç"). Üründe hiçbir şey değişmez. Daha çok ışık ve daha sade bir zeminle **"New photo"** deneyin.

### Sahne 5 (3:00-3:30) Toparlama

**Söyleyin:** "Fotoğraf ekle, kenarlara bak, Approve ya da Discard. Orijinalim hep saklanır, hiçbir şey kaybolmaz."

---

## Ne ters gidebilir

| Gördüğünüz | Anlamı / ne yapmalı |
|---|---|
| Sarı kutu "Photo processing is switched off…" ve gri düğmeler | Fotoğraf servisi sunucuda kurulu değil. Lead'e haber verin. |
| "The photo worker is not responding. Try again in a minute." | Fotoğraf servisi meşgul ya da yeniden başlıyor. Bir dakika bekleyip sayfayı yenileyin. Devam ederse lead'e haber verin. |
| "Photo too small, please retake closer" | Fotoğrafın kısa kenarı 1000 pikselden az. Yaklaşın. |
| "The product is too small in the photo, please retake closer" | Ürün karenin daha büyük kısmını kaplasın. |
| "No product found in the photo, please retake it against a plain background" | Sade, açık renkli zemin ve iyi ışık. |
| "Photo has too many pixels (at most 50 megapixels)" / "larger than 25 MB" | Kamerayı en yüksek ayarda değil, normal ayarda kullanın. |
| Başka biri de aynı anda fotoğraf temizliyor | Aynı anda tek fotoğraf işlenir. Sadece biraz daha uzun sürer. |
| Yanlış fotoğrafı onayladınız | Eski fotoğraflar üründe duruyor, orijinal de saklı. Ana fotoğrafı ürünün **"Media"** bölümünden değiştirin ⚠ ya da daha iyi bir fotoğraf ekleyip onaylayın. |

## Unutmayın

- Sadece arka plan değişir. Hiçbir şey çizilmez, eklenmez, "güzelleştirilmez".
- Orijinal fotoğraf her zaman saklanır.
- Ürünün bir parçası eksik ya da farklı görünüyorsa asla onaylamayın.
- Aynı fotoğrafı iki kez onaylamak onu iki kez eklemez.
