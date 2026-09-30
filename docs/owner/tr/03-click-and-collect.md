# Senaryo 3: Click & Collect (mağazadan teslim) panosu

- **Süre:** yaklaşık 5 dakika
- **Gerekenler:** admin.technest.co.uk'a giriş yapılmış telefonunuz; bir **deneme** Click & Collect siparişi (kayıttan önce sitede test kartıyla, ödeme adımında Click & Collect seçerek verin). Gerçek müşteri siparişini asla kullanmayın.
- **Nerede:** menü → **"Click & Collect"** (adres `/app/click-collect`).
- **Durum:** 2026-09-30'da bitmiş panel koduyla karşılaştırıldı.

---

### Sahne 1 (0:00-0:30) Pano ne işe yarar

**Dokunun:** menü → **"Click & Collect"**.

**Göreceğiniz:** "Updates every minute. Last updated …" (her dakika yenilenir, son güncelleme …), bir **"Refresh"** ("Yenile") düğmesi ve telefonda üç düğme: **"To pick"** (hazırlanacak), **"Ready"** (hazır), **"Collected"** (teslim edildi); her birinin yanında sayı. (Bilgisayarda üçü yan yana durur.)

**Söyleyin:** "Click & Collect seçen müşteri kargo ücreti ödemez, siparişini dükkandan alır. Her sipariş önce To pick, sonra Ready, sonra Collected olur. Pano her dakika kendini yeniler."

### Sahne 2 (0:30-1:15) Sipariş kartını okuyun

**Dokunun:** **"To pick"**.

**Göreceğiniz:** en eskisi üstte olacak şekilde kartlar. Her kartta **"Order #1042"** (sipariş no), "Placed 2 hours ago" (2 saat önce verildi), "The collection code is made when you press Mark ready." (teslim kodu Mark ready'e basınca oluşur), müşterinin adı, ürünler (ör. "2 x USB-C cable (1 m)") ve **"Total £9.98 inc. VAT"** (KDV dahil toplam).

**Söyleyin:** "En üstteki, en eski siparişten başlıyorum. Ürünleri raftan alıyorum. Rengi ve modeli kontrol ediyorum: 16 Pro kılıfı, 16 kılıfı değildir."

### Sahne 3 (1:15-2:15) Hazır olarak işaretleyin

**Dokunun:** poşeti hazırlayın, sonra karttaki **"Mark ready"** ("Hazır işaretle").

**Göreceğiniz:** "Order #1042 is ready. Code K7MQ2X." Kart **"Ready"** sütununa geçer ve **"Collection code"** (teslim kodu) büyük harflerle görünür.

**Söyleyin:** "Müşteriye şimdi 'siparişiniz hazır' e-postası gidiyor; içinde kod, adresimiz ve bugünkü çalışma saatlerimiz var. Poşetin üstüne sipariş numarasını ve adı yazıp tezgahın arkasına koyuyorum. Yanlışlıkla iki kez Mark ready'e bassam bir şey olmaz: tek kod, tek e-posta."

### Sahne 4 (2:15-3:30) Müşteri geldi

**Dokunun:** **"Ready"**. Siparişi bulun. Müşteriye adını ve kodunu sorun.

**Dokunun:** **"Collected"**.

**Göreceğiniz:** bir soru: "Hand over order #1042?" (Siparişi teslim ediyor musunuz?) "Check the code K7MQ2X with the customer first. Pressing Collected takes the payment of £9.98 from their card." (Önce kodu müşteriyle kontrol edin. Collected'a basınca kartından £9.98 çekilir.) Düğmeler: **"Not yet"** ("Henüz değil") ve **"Yes, collected"** ("Evet, teslim edildi").

**Dokunun:** **"Yes, collected"**.

**Göreceğiniz:** "Order #1042 collected. Payment taken." (teslim edildi, ödeme alındı). Kart **"Collected"** sütununa geçer.

**Söyleyin:** "Bu önemli: kart ancak Collected'a bastığımda çekilir. O zamana kadar para sadece bloke durur. O yüzden poşet dükkandan çıkarken basarım, önce değil; ve asla unutmam."

### Sahne 5 (3:30-4:30) Alınmayan siparişler

**Göreceğiniz:** Ready kartında **"Reminder: Not sent yet (sent 3 days after ready)"** (hatırlatma henüz gitmedi, hazır olduktan 3 gün sonra gider); daha sonra **"Sent …"** (gönderildi) ve turuncu bir etiket: "Reminder sent. Cancelled automatically 7 days after ready." (Hatırlatma gitti; hazır olduktan 7 gün sonra otomatik iptal edilir.)

**Söyleyin:** "Hazır olduktan üç gün sonra müşteriye kendiliğinden hatırlatma e-postası gider. Yedi gün sonra sipariş kendiliğinden iptal olur, karttaki bloke kalkar ve müşteriye iptal e-postası gider. Müşteriden para çekilmez. İptal olan siparişler panodan kaybolur; ürünleri rafa geri koyarım."

### Sahne 6 (4:30-5:00) Toparlama

**Söyleyin:** "To pick, hazırla, Mark ready. Tezgahta: kodu kontrol et, sonra Collected. Bu panoya her sabah ve gün içinde tekrar bakarım."

---

## Ne ters gidebilir

| Gördüğünüz | Anlamı / ne yapmalı |
|---|---|
| "Payment could not be captured…" | Kart şirketi ödemeyi reddetti. Hiçbir şey çekilmedi; sipariş Ready'de kalır. Müşteriden kasada ödeme alın ya da daha sonra tekrar **"Collected"**a basın. "Ödeme başarısız" e-postasının bir kopyası dükkana da gelir. |
| "Payment captured but…" ile başlayan mesaj | Para **çekildi** ama sonraki bir adım başarısız oldu. **Hiçbir şey iade edilmez.** Tekrar **"Collected"**a basın: kalan adımları iki kez çekmeden tamamlar. Tekrarlarsa mesajı lead'e gösterin. |
| Kırmızı kutu ve "Refresh the board and try again." | Aynı siparişe başka biri (ya da çift dokunuş) aynı anda işlem yaptı. **"Refresh"**e basıp tekrar deneyin. |
| Collected reddedildi ("not allowed") | Sipariş iptal edilmiş, henüz hazır işaretlenmemiş ya da karttaki bloke süresi dolmuş (ör. 7 günden sonra). Ödemesiz mal vermeyin: kasada ödeme alın ya da yeniden sipariş vermesini isteyin. |
| Kod tutmuyor | Poşeti vermeyin. Adı ve sipariş numarasını kontrol edin, e-postayı göstermesini isteyin. |
| Collected'a erken bastınız | Karttan para çekildi. Başka bir şeye basmayın. Müşteri malı hiç almazsa sipariş sayfasından iade edin (senaryo 8). |
| Bir sipariş panoda yok | İptal edilen siparişler burada hiç görünmez. **"Orders"** (Siparişler) bölümüne bakın. |
| **"Collected"** sadece son 20'yi gösteriyor | "Showing the latest 20 of …". Eskiler **"Orders"**da. |

## Unutmayın

- Para ancak **"Collected"**a bastığınızda çekilir.
- Tezgahta teslim kodunu her zaman kontrol edin.
- Hazır olduktan 3 gün sonra hatırlatma e-postası. 7 gün sonra otomatik iptal ve kart blokesinin kalkması.
- Click & Collect her zaman ücretsiz. Tek başına £1'lık ek ürünler Click & Collect ile alınabilir.
- İadeler yönetim panelindeki sipariş sayfasından yapılır, Stripe sitesinden asla (senaryo 8).
