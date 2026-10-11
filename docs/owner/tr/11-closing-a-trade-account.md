# Senaryo 11: Trade (toptan) hesabını kapatma

- **Süre:** yaklaşık 2 dakika
- **Gerekenler:** onaylanmış bir deneme trade başvurusu (senaryo 6, A bölümü).
- **Nerede:** menü → **"Orders"** (Siparişler) → **"Trade"** sekmesi → **"Approved"** (onaylanan) → başvuruyu açın (adres `/app/trade-applications/<id>`).
- **Durum:** 2026-10-11'de panel koduyla karşılaştırıldı.
- **Hedef:** artık toptan fiyat almaması gereken bir işletmeden toptan fiyatları geri almak, nedenini söylemek ve sonra yeniden başvurabilmesini sağlamak.

---

### Sahne 1 (0:00-0:30) Hesabı bulun

**Dokunun:** menü → **"Orders"** → **"Trade"** → **"Approved"**. İşletmeyi açın.

**Göreceğiniz:** şirket adı ve yeşil **"Approved"** etiketi, bilgiler ve en altta: "Approved. This customer sees trade prices when logged in." (Onaylı. Bu müşteri giriş yapınca toptan fiyatları görür.), "Closing the account takes trade prices away straight away; the customer is emailed and can apply again later." (Hesabı kapatmak toptan fiyatları hemen kaldırır; müşteriye e-posta gider ve sonra yeniden başvurabilir.) ve bir **"Close trade account"** (trade hesabını kapat) düğmesi.

**Söyleyin:** "Bir işletme kapanır, bizimle çalışmayı bırakır ya da aslında işletme olmadığı anlaşılır. O zaman trade hesabını kapatıyorum. O andan itibaren herkesle aynı fiyatı öderler."

### Sahne 2 (0:30-1:30) Kapatın

**Dokunun:** **"Close trade account"**.

**Göreceğiniz:** "Close the trade account for Acme Phones Ltd?" (Acme Phones Ltd'nin trade hesabı kapatılsın mı?) paneli; onaylar onaylamaz perakende fiyata döneceklerini ve e-posta alacaklarını söyleyen bir not; bir **"Reason (optional)"** (neden, isteğe bağlı) kutusu; ve **"Keep it open"** (açık kalsın) ile **"Close account and email"** (hesabı kapat ve e-posta gönder) düğmeleri.

**Dokunun:** e-postada görünsün istiyorsanız kısa ve nazik bir neden yazın, örneğin "The business has closed" (işletme kapandı) ya da "No trade orders in the last year" (son bir yılda toptan sipariş yok). Sonra **"Close account and email"**.

**Göreceğiniz:** "Trade account for Acme Phones Ltd closed." (hesap kapatıldı). Etiket artık gri: **"Trade account closed"**. Bilgilerin altında "Reason given" (verilen neden) yazdığınızı gösterir ve "Trade account closed. The customer pays retail prices and can apply again." (Hesap kapalı. Müşteri perakende fiyat öder ve yeniden başvurabilir.)

**Söyleyin:** "Müşteriye sade bir e-posta gider: hesap kapandı, yazdıysam nedeni ve yeniden başvurabilecekleri. Açık bir sepetleri varsa o da artık perakende fiyattan hesaplanır."

### Sahne 3 (1:30-2:00) Kapatılan hesaplar nerede

**Dokunun:** **"All trade applications"** (tüm başvurular) ile geri dönün → **"Closed"** (kapatılan).

**Göreceğiniz:** kapatılan tüm hesaplar. Kapatılmış başvuruda düğme yoktur: işletme yeniden toptan fiyat alacaksa sitede yeniden başvurur, siz yeni başvuruyu onaylarsınız (senaryo 6).

---

## Ne ters gidebilir

| Ekranda | Anlamı ve yapılacak |
|---|---|
| **"Close trade account"** düğmesi yok | Sadece onaylanmış başvuruda vardır. Bekleyen başvuru reddedilir (senaryo 6); reddedilmiş ya da kapatılmış olanla yapılacak bir şey yoktur. |
| Bastıktan sonra panelde hata | Hiçbir şey değişmedi. Mesajı okuyun; **"Keep it open"**a basın, sayfayı yenileyip etikete bakın. Hâlâ **"Approved"** yazıyorsa tekrar deneyin. |
| Yanlış hesabı kapattınız | Geri alma yok. İşletmeden sitede yeniden başvurmasını isteyin (iki dakika sürer) ve onaylayın. Hatanın sizde olduğunu söyleyin. |

## Unutmayın

- Kapatma anında olur ve müşteriye e-posta gider. Önce karar verin, sonra basın.
- Neden, müşteriye kelimesi kelimesine gider. Kısa ve nazik tutun.
- Kapatılan işletme yeniden başvurabilir; reddedilen de.
