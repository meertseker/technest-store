# Senaryo 5: "Shop settings" (Mağaza ayarları: ücretsiz kargo ve Klarna)

- **Süre:** yaklaşık 3 dakika
- **Gerekenler:** admin.technest.co.uk'a giriş yapılmış telefon veya bilgisayar; etkisini göstermek için ikinci bir sekmede açık site. Sonunda her değeri eski haline getirin.
- **Nerede:** menü → **"Settings"** (Ayarlar, menünün en altında) → **"Shop settings"** (adres `/app/settings/technest`).
- **Durum:** 2026-09-30'da bitmiş panel koduyla karşılaştırıldı. ⚠ "Shop settings"in Medusa ayar menüsündeki yeri (genelde "Extensions" başlığı altında) Medusa'nın kendi ekranıdır: bir kez bakın.

---

### Sahne 1 (0:00-0:30) Bu sayfada ne var

**Dokunun:** menü → **"Settings"** → **"Shop settings"**. ⚠

**Göreceğiniz:** "Shop settings", "Free delivery and Klarna thresholds. Amounts include VAT." (ücretsiz kargo ve Klarna sınırları, tutarlar KDV dahil), bir **"Edit"** ("Düzenle") düğmesi ve iki satır:
- **"Free Standard delivery from"** (standart kargo şu tutardan itibaren ücretsiz) £20.00
- **"Klarna from"** (Klarna şu tutardan itibaren) £30.00

**Söyleyin:** "Mağazanın iki para kuralı. Sık değiştirmem gerekmez ama yerini bilmek iyi."

### Sahne 2 (0:30-1:30) Ücretsiz kargo

**Dokunun:** **"Edit"**. **"Free Standard delivery from (£)"** alanına `25` yazın. **"Save"**.

**Göreceğiniz:** "Settings saved" (ayarlar kaydedildi); satırda artık £25.00 yazar.

**Dokunun:** sitede sepete £10'luk bir ürün koyun: çubukta "£15.00 away from free delivery" (ücretsiz kargoya £15 kaldı) yazar.

**Söyleyin:** "Sepet KDV dahil bu tutara ulaşınca Standart kargo ücretsiz olur. Ertesi gün teslimat hiçbir zaman ücretsiz değil. Click & Collect her zaman ücretsiz. Değişiklik hemen geçerli olur."

### Sahne 3 (1:30-2:15) Klarna

**Söyleyin:** "Klarna, müşterinin sonra ya da taksitle ödemesini sağlar. Ödeme sayfasında ancak sepet en az bu tutardaysa görünür. Özel bir nedeniniz yoksa otuz sterlinde bırakın."

### Sahne 4 (2:15-3:00) Eski haline getirin

**Dokunun:** **"Edit"** → `20` yazın → **"Save"**. Sayfayı yenileyin: £20.00 duruyor.

**Söyleyin:** "Sterlin yazıyorum, 20 ya da 20.00 gibi. Bir sayı tuhaf görünürse hemen düzeltirim, çünkü müşteri görüyor."

---

## Ne ters gidebilir

| Gördüğünüz | Anlamı / ne yapmalı |
|---|---|
| "Enter an amount between £0.00 and £1,000.00, e.g. 20.00" | Peni değil sterlin yazın; en fazla £1.000. |
| "Couldn't save the settings" | Tekrar deneyin. Devam ederse lead'e haber verin. |
| Ücretsiz kargo £0 yapıldı | O zaman Standart kargo hep ücretsiz olur. Bunu sadece bilerek yapın. |

## Yeniden sipariş seviyeleri nerede?

Her sabah 08:00'deki düşük stok e-postası her ürünün **yeniden sipariş seviyesine** (reorder level,
normalde 3) bakar. Bunun için henüz bir ekran yok: CSV içe aktarmada `reorder_level` sütunuyla
ayarlanır (senaryo 7). [LEAD?]

## Unutmayın

- Tüm tutarlar sterlin ve KDV dahil.
- Ücretsiz kargo sadece Standart kargo için. Ertesi gün teslimat hiç ücretsiz değil. Click & Collect her zaman ücretsiz.
- Klarna sadece Klarna tutarında ve üstünde görünür (normalde £30).
