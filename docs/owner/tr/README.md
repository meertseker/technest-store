# Tech Nest Online: işletme sahibi rehberleri

Bu rehberler dükkan sahibi için. Online mağazanın **admin.technest.co.uk** adresindeki yönetim
panelinden (admin) nasıl yönetileceğini anlatır. Telefonda da bilgisayarda da kullanılabilir.

Telefonda sol üstteki menü düğmesine basın. Tech Nest sayfaları açılan sol menüde (sidebar) yer alır.

Panelin dili İngilizce. Bu yüzden düğme adlarını ekranda göründüğü gibi İngilizce ve tırnak içinde
yazdık, yanına Türkçesini ekledik. Örnek: **"Save as draft"** ("Taslak olarak kaydet").
Ekrandaki İngilizce mesajları da aynen yazdık ki tanıyabilesiniz.

İngilizce asıllar [`../en/`](../en/) klasöründe; genel dizin [`../README.md`](../README.md).

## Bu klasörde neler var

| Dosya | Ne işe yarar | Menü |
|---|---|---|
| [01-quick-add.md](./01-quick-add.md) | Telefon fotoğrafından yapay zekâ önerisiyle ürün, taslak olarak | "Quick add" |
| [02-photo-widget.md](./02-photo-widget.md) | "Product photo" kutusu: "Process", "Approve", "Discard" | "Products" → ürün |
| [03-click-and-collect.md](./03-click-and-collect.md) | Pano: "To pick", "Mark ready", "Collected" (parayı çeker); 3. gün hatırlatma, 7. gün iptal | "Click & Collect" |
| [04-devices.md](./04-devices.md) | "Devices" sayfası ve üründeki "Fits these devices" | "Devices" |
| [05-settings.md](./05-settings.md) | Ücretsiz Standart kargo ve Klarna tutarları | "Settings" → "Shop settings" |
| [06-trade-and-repairs.md](./06-trade-and-repairs.md) | Toptan (trade) başvuruları ve tamir randevuları | "Trade applications", "Repair bookings" |
| [07-import-and-product-rules.md](./07-import-and-product-rules.md) | CSV ile ürün yükleme; güvenlik işareti, vape, £1 ek ürün, 3 al 2 öde, yeniden sipariş seviyesi | "Import products" |
| [08-orders-and-refunds.md](./08-orders-and-refunds.md) | Kargolu siparişler, iptal, iade (sadece panelden, Stripe'tan asla) | "Orders" |
| [first-week-routine.md](./first-week-routine.md) | Tek sayfa: günlük rutin ve ilk hafta kontrol listesi | |

## Senaryolar nasıl kullanılır

01-08 arası dosyalar **ekran kaydı senaryolarıdır**. Her biri 3-5 dakikalık bir video çıkarır.

1. Paneli her gün kullanacağınız cihazda açın (genelde telefonunuz).
2. Ekran kaydını başlatın.
3. Sahneleri sırayla izleyin. **Dokunun** neye basacağınızı, **Göreceğiniz** ekranda ne çıkacağını,
   **Söyleyin** ne diyeceğinizi gösterir.
4. **Deneme ürünü** veya **deneme siparişi** kullanın. Gerçek müşteri siparişiyle kayıt yapmayın.
5. Videoyu saklayın. Bir adımı unuttuğunuzda tekrar izleyin.

Her senaryonun sonunda **Ne ters gidebilir** (ekrandaki mesaj ve ne yapılacağı) ve **Unutmayın** bölümleri var.
Senaryoları kayıt yapmadan, adım adım kullanım kılavuzu olarak da okuyabilirsiniz.

## Kodla karşılaştırıldı; açık kalanlar

Tüm senaryolar 2026-09-30'da bitmiş panel sayfalarıyla (düğme adları, mesajlar, adımların sırası)
karşılaştırıldı. İki tür işaret kaldı:

- **⚠** : adım Medusa'nın kendi ekranlarından birini kullanıyor (Orders, ürün düzenleme, Promotions,
  Customers, Pricing, Settings menüsü). Kayıttan önce lead o ekranı bir kez açıp düğme adına bakar,
  sonra işareti siler.
- **[LEAD?]** : lead'in karar vermesi ya da tamamlaması gereken bir konu. Cevaplanmadan o kısmı kaydetmeyin.

### Kayıttan önce lead için

- Senaryolarda geçen tüm e-postalar `main`de.
- Mevcut bir ürünün güvenlik işareti (UKCA/CE), £1 ek ürün işareti ve yeniden sipariş seviyesi ürün
  sayfasındaki "Product details for Tech Nest" kutusundan düzenlenir (Quick add'den sonra da). Çok
  sayıda ürün için senaryo 7'deki CSV içe aktarma da çalışır.
- Toptan kademe fiyatları Medusa'nın **"Trade"** fiyat listesine sterlin ve KDV dahil giriliyor. Kim girecek? [LEAD?]

## Bu rehberlerdeki bazı kelimeler

- **SKU**: ürünün stok kodu (örneğin `TN-CASE-IP16-CLR`).
- **Draft** (taslak): kaydedilmiş ama sitede henüz görünmeyen ürün.
- **Publish** (yayınla): ürünü sitede görünür yapmak.
- **Add-on item** (ek ürün): £1'lık ürün. Her sepete girebilir ama sadece ek üründen oluşan sepet kargoyla gönderilemez. Click & Collect olur.
- **Collection code** (teslim kodu): müşterinin tezgahta söylediği 6 harf ve rakam (`K7MQ2X` gibi).
- **Bloke** (provizyon): kartta tutulan ama henüz çekilmemiş para.
