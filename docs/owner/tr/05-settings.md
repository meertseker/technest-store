# Senaryo 5: "Shop settings" (Mağaza ayarları: ücretsiz kargo ve Klarna)

- **Süre:** yaklaşık 3 dakika
- **Gerekenler:** admin.technestlondon.co.uk'a giriş yapılmış telefon veya bilgisayar; etkisini göstermek için ikinci bir sekmede açık site. Sonunda her değeri eski haline getirin.
- **Nerede:** menü → **"Shop settings"** (Mağaza ayarları) → **"Delivery & Klarna"** (Kargo ve Klarna) sekmesi (adres `/app/shop-settings?tab=thresholds`; eski `/app/settings/technest` adresi de buraya açılır).
- **Durum:** 2026-10-11'de panel koduyla karşılaştırıldı (menü: Today, Orders, Products, Shop settings; her birinde sekmeler). Shop settings artık Medusa'nın Settings menüsünün içinde değil, bizim dört menü sayfamızdan biri.

---

### Sahne 1 (0:00-0:30) Bu sayfada ne var

**Dokunun:** menü → **"Shop settings"**. **"Delivery & Klarna"** sekmesi açık gelir.

**Göreceğiniz:** "Delivery & Klarna" başlığı, "The basket amounts for free delivery and for Klarna. Amounts include VAT." (ücretsiz kargo ve Klarna için sepet tutarları, KDV dahil), bir **"Edit"** ("Düzenle") düğmesi ve iki satır:
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
normalde 3) bakar. Ürün sayfasındaki "Product details for Tech Nest" kutusunda → "Edit" →
"Reorder level" alanından değiştirilir; çok sayıda ürün için CSV içe aktarmada `reorder_level` sütunu da
kullanılabilir (senaryo 7).

## Unutmayın

- Tüm tutarlar sterlin ve KDV dahil.
- Ücretsiz kargo sadece Standart kargo için. Ertesi gün teslimat hiç ücretsiz değil. Click & Collect her zaman ücretsiz.
- Klarna sadece Klarna tutarında ve üstünde görünür (normalde £30).
