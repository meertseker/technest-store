# Senaryo 8: Kargolu siparişler, iptal ve iade

- **Süre:** yaklaşık 4 dakika
- **Gerekenler:** admin.technest.co.uk'a giriş yapılmış telefon veya bilgisayar; kayıttan önce test kartıyla verilmiş bir **deneme** kargolu sipariş.
- **Nerede:** menü → **"Orders"** (Siparişler) → bir sipariş (Medusa'nın kendi sipariş sayfası).
- **Durum:** ⚠ bu senaryo bizim değil, Medusa'nın kendi sipariş sayfasını kullanır. Kurallar (karttan paranın ne zaman çekildiği, iadenin nereden yapıldığı) 2026-09-30'da kodla karşılaştırıldı; düğme adlarına canlı panelde bir kez bakılmalı.

---

### Sahne 1 (0:00-0:40) Yeni bir kargolu sipariş

**Göreceğiniz:** hello@technest.co.uk'a "New order #1043 · Delivery · £24.98" konulu bir e-posta. (Click & Collect siparişlerinin konusunda "CLICK & COLLECT" yazar; onlar panoya düşer, senaryo 3.)

**Dokunun:** menü → **"Orders"** → #1043'ü açın.

**Söyleyin:** "Kargolu siparişlerde para, sipariş verilir verilmez kendiliğinden karttan çekilir. Ödeme için hiçbir şeye basmıyorum."

### Sahne 2 (0:40-1:45) Paketleyin ve kargoya verin ⚠

**Dokunun:** ürünler bölümünde **"Fulfill items"** (ürünleri hazırla) → konum "Tech Nest – Southwark Park Rd" → oluşturun. Paketi hazırlayın. Sonra oluşan gönderide **"Mark as shipped"** (kargoya verildi işaretle), varsa takip numarasını ekleyip kaydedin. ⚠

**Söyleyin:** "Kargoya verildi olarak işaretleyince müşteriye 'siparişiniz yolda' e-postası gider."

### Sahne 3 (1:45-2:30) Sipariş iptali ⚠

**Dokunun:** siparişin menüsü (⋯) → **"Cancel order"** (siparişi iptal et). ⚠

**Söyleyin:** "Click & Collect siparişi henüz teslim alınmadıysa karttan hiç para çekilmemiştir: iptal sadece blokeyi kaldırır ve müşteriye iptal e-postası gider. Teslim alınmayan siparişler zaten 7 gün sonra kendiliğinden iptal olur."

### Sahne 4 (2:30-3:30) İade: sadece panelden ⚠

**Dokunun:** siparişin **"Payments"** (ödemeler) bölümünde ödemenin menüsü (⋯) → **"Refund"** (iade) → kısmi iade için tutarı sterlin olarak yazın ya da tam tutarı bırakın → onaylayın. ⚠

**Göreceğiniz:** iade siparişte görünür. Müşteriye tutarı ve "5–10 working days" (5-10 iş günü) bilgisini içeren bir e-posta gider.

**Söyleyin:** "İadeyi her zaman burada, panelde yaparım. Stripe sitesinden **asla** iade yapmam: Stripe'ta yapılan iade bizim sisteme ulaşmaz, sipariş hâlâ ödenmiş görünür ve müşteriye e-posta gitmez."

### Sahne 5 (3:30-4:00) Toparlama

**Söyleyin:** "Kargo: para kendiliğinden çekilir; ben paketleyip kargoya verildi işaretlerim. Click & Collect: para Collected'a bastığımda çekilir. İade: sadece paneldeki sipariş sayfasından."

---

## Ne ters gidebilir

| Gördüğünüz | Anlamı / ne yapmalı |
|---|---|
| "You cannot refund more than what is captured on the payment." | Karttan hiç para çekilmemiş (ör. henüz teslim alınmamış Click & Collect). Onun yerine siparişi iptal edin; bu blokeyi kaldırır. |
| İade reddedildi, tutar fazla | En fazla ödenen tutar, önceki iadeler düşülerek iade edilebilir. |
| Kargolu sipariş için "ödeme başarısız" (payment failed) e-postası | Karttan para çekilmedi. **Kargoya vermeyin.** Müşteriyle iletişime geçin. [LEAD?] ödeme yeniden nasıl alınacak |
| Yanlışlıkla Stripe'tan iade yapıldı | Lead'e haber verin. Panel bunu göstermez, müşteriye bizden e-posta gitmedi. |

## Unutmayın

- Kargolu siparişler: sipariş sonrası otomatik çekilir. Click & Collect: **"Collected"**a basınca çekilir.
- Siparişi "ödendi" yapan tek şey ödeme şirketinin imzalı bildirimi; müşterinin tarayıcısı asla.
- İade: her zaman paneldeki sipariş sayfasından, Stripe panelinden asla.
