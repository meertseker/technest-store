# Tech Nest Online: durum raporu (30 Eylül 2026, bulut oturumu)

Bu rapor, bulut oturumunda yapılan işi, testlerin kesin sonuçlarını, kalan işleri ve lead'e (size)
sorulan soruları özetler. Soruların İngilizce tam metni ve seçilen varsayılanlar:
`docs/brief/LEAD_QUESTIONS.md` (Q1–Q68).

Önemli not: dört mühendis brifi (`E*_PROMPT.md`) ve `TEAM_CHAT.md` depoda yoktu. İş; `CLAUDE.md`,
`docs/specs/design.md`, `docs/contracts/*`, ADR'ler, planlar ve dal geçmişine göre yapıldı.

## 1. Birleştirilenler (main, hepsi `--ff-only`)

Tüm iş `claude/peaceful-thompson-0ooaf0` dalına itildi (GitHub'daki `main`e dokunulmadı; yayınlamak için
`git push origin origin/claude/peaceful-thompson-0ooaf0:main`). Son commit: `855796d`.
Oturum başından beri: 105 commit, 724 dosya, +53.809 / −5.270 satır.

Her birleştirmeden önce aynı kapı çalıştı: backend build (tip + lint), unit, modül, tüm HTTP entegrasyon
testleri, e-posta paketi testleri, storefront typecheck + unit + build, kök lint. Kırmızı olan hiçbir dal
birleştirilmedi.

**Yarım kalmış (WIP) dallar, bitirildi ve test edildi**

| Dal | İçerik |
|---|---|
| `e4/ops` | Sentry (DSN yoksa kapalı, kişisel veri temizleme, /checkout'ta yok), yedekleme, Türkçe DEPLOY.md |
| `e1/product-attributes` | Ürün özellikleri modülü, UKCA/CE yayın kuralı, vape engeli, seed koruması |
| `e1/trade-repair` | Toptan hesap başvurusu ve kademeli fiyat, tamir randevusu, Turnstile, hız sınırı |
| `e4/photo-pipeline` | Fotoğraf modülü, arka plan kaldırma (birefnet-general, bria asla), orijinal her zaman saklanır |
| `e4/csv-import` | CSV ürün içe aktarma (önizleme, geri alma), sahip rehberleri |
| `e2/emails-*` (4 dal) | Hoş geldin, şifre sıfırlama, kargoya verildi, iptal, iade, iade teslim, teslime hazır, hatırlatma, ödeme alınamadı, toptan/tamir/düşük stok e-postaları |
| `e2/capture-collection` | Kargo siparişinde ödemenin hemen çekilmesi, Click & Collect hazır/teslim, 3. gün hatırlatma, 7. gün iptal |
| `e3/device-picker` + `e3/content-legal` | Cihaz seçici ve 3 bilinen hatası, Google yorumları, yasal sayfalar, çerez onayı, site haritası |

**Backlog, yeni yapılanlar**

- **E1:** ayarlar modülü + `GET /store/technest-settings` + admin sayfası, £20 üstü ücretsiz kargo,
  £1 ek ürün kuralı, "3'ü £2" kampanyası, arama eş anlamlıları, arama sonuçlarının cihaza uyması, düşük stok işi (08:00).
- **E2:** Klarna yalnız alt limitin üstünde, iadeler (admin'den), imzasız Stripe webhook'larının reddi,
  Stripe Payment Element ödeme adımı, ödeme e2e testleri, mailserver + DEPLOY.md e-posta bölümü.
- **E3:** gerçek fotoğraf ve yorumlu ana sayfa, kategori/ürün/cihaz/arama sayfaları, sepet çekmecesi,
  Click & Collect'li tek sayfa ödeme, sipariş onayı, hesap sayfaları, toptan sayfaları, /repairs,
  erişilebilirlik ve Lighthouse geçişi.
- **E4:** Claude görsel destekli Quick Add, ürün fotoğraf kutusu, Click & Collect panosu, cihazlar sayfası
  ve kutusu, toptan başvuru ve tamir randevu sayfaları, "Product details for Tech Nest" kutusu,
  sahip rehberleri (EN + TR, 8 senaryo), DEPLOY.md env tablosu ve yayın öncesi kontrol listesi,
  CI'da HTTP testlerinin tek tek çalışması, üretim yapılandırması düzeltmeleri (Turnstile anahtarları).

## 2. Kesin test sonuçları (son kapı, `855796d` üzerinde)

| Kontrol | Sonuç |
|---|---|
| Backend build (tip + lint + admin) | geçti |
| Backend unit | 37 paket, 300/300 test geçti |
| Backend modül entegrasyon | 7 paket, 76/76 test geçti |
| Backend HTTP entegrasyon | 29 dosya, 274 test, hepsi geçti |
| E-posta şablon paketi | 33/33 geçti |
| Storefront typecheck | geçti |
| Storefront unit (vitest) | 55 dosya, 436/436 test geçti |
| Storefront build | geçti |
| Kök lint | geçti |
| Erişilebilirlik (axe), 34 sayfa × 375/1280 | 68/68 geçti, 0 ihlal |
| Lighthouse mobil (performans, üretim derlemesi, 3 ölçümün ortancası) | Ana sayfa 94, kategori 96, ürün 97, ödeme 97 |

Açık uyarılar:
- Ödeme sayfasının Lighthouse SEO puanı 63, çünkü ödeme bilerek arama motorlarından gizli (noindex).
- LCP yerelde 2,2–2,8 sn; hedef 2,0 sn. Canlı sitede PageSpeed Insights ile tekrar ölçülmeli.
- Tam Playwright e2e takımında birkaç test yalnızca `next dev` ile çalışıyor (test ödeme sağlayıcısı
  üretim derlemesinde kapalı) veya aralıklı başarısız oluyor (cihaz seçici zamanlaması).
- Kartla ödeme gerçek Stripe test anahtarlarıyla çalıştırılmadı; yalnızca test ödeme sağlayıcısı ve
  Stripe'ı taklit eden testler çalıştı. Nasıl çalıştırılacağı: `apps/storefront/e2e/README-payment.md`.
- Quick Add gerçek bir Anthropic anahtarıyla denenmedi; yalnızca yerel taklit sunucuyla test edildi.

## 3. Geçici canlı önizleme

- Storefront: https://technest-store-preview.vercel.app (Vercel'e giriş yapmanız gerekir).
- Backend ve admin: Vercel Sandbox, https://sb-bk6dyrbtd4o3.vercel.run/app
  (admin@technest.local / TechNestPreview2026). Hobby planında her oturum en fazla 45 dakika açık kalır;
  sonra durur ve yeniden başlatılması gerekir. Veriler korunur.
- Bu önizleme üretim değildir. Üretim Hetzner + Docker Compose + Caddy + Cloudflare olarak kalıyor
  (`docs/preview-vercel.md`).

## 4. Kalanlar

**Kodda (küçük işler)**
- Ürün sayfasında "Complete your setup" satırı; sepet çekmecesinde "Add for £1" önerileri; ödeme yöntemi simgeleri.
- `/repairs` ve `/trade` site haritasında yok; `/verify-account` sayfası yeniden tasarlanmadı.
- Teslim tarihi tahmininde resmi tatiller yok.
- LCP hedefi (2,0 sn) canlıda doğrulanmalı; birkaç aralıklı e2e testi sağlamlaştırılmalı.

**Sizin veya gerçek sunucunun gerektirdiği işler**
- Stripe test anahtarlarıyla kartla ödeme testi; sonra canlı anahtarlar ve webhook (DEPLOY.md 5.4).
- `ANTHROPIC_API_KEY` ve Quick Add'in gerçek fotoğraflarla denenmesi.
- Hetzner sunucusunda staging kurulumu, DNS/e-posta kayıtları (MX, SPF, DKIM, DMARC, PTR), R2, Sentry DSN'leri,
  Turnstile anahtarları, yedekten geri yükleme tatbikatı (DEPLOY.md bölüm 12 kontrol listesi).
- Yasal bilgiler: şirket adı, şirket numarası, KDV ve ICO numaraları, iletişim e-postası, kargo firması, süreler.
- Gerçek ürünler ve fotoğraflar, "Trade" fiyat listesindeki toptan fiyatlar, Google yorumlarının kontrolü.
- Aşağıdaki soruların yanıtları.

## 5. Size sorular (her biri için seçilen varsayılan)

**Süreç ve araçlar**
1. Q1 – Brifler (`E*_PROMPT.md`) ve `TEAM_CHAT.md` depoda yok. *Varsayılan:* CLAUDE.md, tasarım dokümanı ve sözleşmelere göre çalışıldı; sonraki oturumlar için `docs/brief/` altına eklenmeli.
2. Q2 – GitHub'daki `main` güncellenmedi. *Varsayılan:* her şey `claude/peaceful-thompson-0ooaf0` dalında; `main`e hızlı ileri alma ile yayınlanabilir.
3. Q3 – Medusa ve ui-ux-pro-max skill'leri konteynerde yoktu. *Varsayılan:* oturum ortasında kuruldu; kalıcı olması için depoya veya SessionStart hook'una eklenmeli.
4. Q4 – GitHub push'u bir süre 403 verdi. *Varsayılan:* siz erişimi yenileyene kadar yerelde commit edildi.
5. Q16 – Sürekli açık bir önizleme için Hetzner sunucusu şimdi staging olarak açılsın mı? Ayrıca GitHub deposu herkese açık; özel yapılsın mı? *Varsayılan:* Vercel + 45 dakikalık sandbox.

**Operasyon ve altyapı (E4)**
6. Q5 – Tarayıcı Sentry'si /checkout'ta aynı alan adı üzerinden çalışsın mı? *Varsayılan:* hayır, /checkout'ta Sentry yok.
7. Q6 – Stripe webhook'u için çalışma süresi izleme? *Varsayılan:* hayır, Stripe'ın hata e-postalarına güvenilir.
8. Q7 – Geri yükleme tatbikatında worker başlatılsın mı? *Varsayılan:* hayır (gerçek ödemeleri çekebilir/iptal edebilir).
9. Q11/Q59 – Caddy ziyaretçi IP başlığını ezer mi? *Varsayılan:* evet, `api.` ve storefront bloklarında uygulandı.
10. Q12 – Sunucu photo-worker'a 6 GB verebilir mi? *Varsayılan:* birefnet-general + 6 GB; yedek isnet-general-use + 4 GB.
11. Q35 – HTTP testleri tek süreçte belleği aşıyor. *Varsayılan:* CI ve birleştirme kapısı her test dosyasını ayrı süreçte çalıştırıyor.
12. Q64 – Üretimde Turnstile anahtarları konteynerlere ulaşmıyordu (her tamir randevusu reddedilirdi). *Varsayılan:* düzeltildi; site key GitHub'da ortam başına **variable**.

**Fotoğraflar (E4)**
13. Q13 – Hafif beyaz dengesi/parlaklık düzeltmesi açılsın mı? *Varsayılan:* kapalı (ürünün rengini değiştirir).
14. Q14 – Küçük ürünler büyütülmüyor, 600 px altı "daha yakından çekin" ile reddediliyor. *Varsayılan:* evet.
15. Q15 – Onaylanmamış işlenmiş fotoğraflar depoda kalıyor (temizleme işi yok). *Varsayılan:* kalsın.
16. Q20 – Fotoğraf işleme kapalıyken önce sağlık kontrolü yapılsın mı? *Varsayılan:* hayır.
17. Q43 – İşleme kapalıyken orijinal fotoğraf ürün görseli olarak onaylanabilsin mi? *Varsayılan:* henüz yapılmadı.

**Ürünler, toptan ve içe aktarma (E1/E4)**
18. Q8 – Üretim `TURNSTILE_SECRET_KEY` olmadan açılmayı reddetsin mi? *Varsayılan:* açılır ama tüm tamir randevuları reddedilir ve loglanır.
19. Q9 – Tarihi geçmiş "Trade" fiyat listesi gizlensin mi? *Varsayılan:* yalnız aktif/pasif durumuna bakılıyor.
20. Q10 – Onaylanıp sonra gruptan çıkarılan müşteri yeniden başvurabilsin mi? *Varsayılan:* hayır, personel değiştirene kadar.
21. Q17 – Vape; başlık, handle, etiket ve kategorideki kelimelerle yakalanıyor. *Varsayılan:* evet.
22. Q18 – Medusa'nın "kategoriye ürün ekle" rotası, UKCA/CE kontrolü için değiştirildi. *Varsayılan:* evet.
23. Q19 – Kategori şarj cihazı kategorisinin altına taşınınca ürünleri yeniden kontrol edilsin mi? *Varsayılan:* şimdilik hayır (belgelenmiş açık).
24. Q21 – Yayındaki şarj cihazı `safety_marking=none` ile yeniden içe aktarılırsa? *Varsayılan:* taslağa alınır, uyarı gösterilir.
25. Q22 – Çok seçenekli üründe SKU yalnız fiyat ve stok günceller. *Varsayılan:* evet, diğer sütunlar uyarıyla yok sayılır.
26. Q60 – Ürünler bağlı cihazların marka/seri/model/takma adlarıyla aranabilir. *Varsayılan:* evet.
27. Q65 – "Trade" fiyat listesine toptan fiyatları kim girecek (KDV dahil, sterlin)? *Varsayılan:* sahip; rehber 06'da anlatıldı.
28. Q68 – "Product details for Tech Nest" kutusunda boş bırakılan alanlar kayıtlı değeri siler. *Varsayılan:* evet.

**Mağaza (E3)**
29. Q23 – Satış verisi yok; "Çok satanlar" yerine "New in". *Varsayılan:* evet; `best-sellers` koleksiyonu açılınca o kullanılır.
30. Q24 – Kategorilerin görseli yok. *Varsayılan:* simge, ya da kategoriye `metadata.image_url` girilirse o görsel.
31. Q25 – Ana sayfa ürün kartlarında "Ekle" düğmesi yok. *Varsayılan:* kartın tamamı ürün sayfasına gider.
32. Q26 – Statik harita görseli yok (API anahtarı gerekir). *Varsayılan:* "Google Maps'te aç" ve "Ara" düğmeleri.
33. Q27 – Yasal bilgiler: şirket adı, şirket no, KDV no, ICO no, e-posta, kargo firması, teslim süreleri, tamir garantisi, Click & Collect bekleme süresi, Sentry veri bölgesi. *Varsayılan:* "[onaylanacak]" yer tutucuları, yasal sayfalar taslak ve noindex.
34. Q28 – Ana görseldeki arama düğmesi koyu (kırmızı değil). *Varsayılan:* koyu kalsın.
35. Q29 – Google yorumları buradan doğrulanamadı. *Varsayılan:* olduğu gibi; gösterilen üç yorumu kontrol edin.
36. Q44 – Ürün sayfasında Standart £3,49 / Ertesi gün £5,99 sabit yazılı. *Varsayılan:* sabit; sık değişirse ayarlara taşınır.
37. Q45 – Varsayılan sıralama "Featured" (stokta olanlar önce). *Varsayılan:* evet.
38. Q46 – Filtreli/sıralı ve arama sayfaları noindex; teslim süresi sözü verilmiyor. *Varsayılan:* evet.
39. Q47 – Click & Collect siparişinde teslimat adresi olarak mağaza adresi yazılıyor. *Varsayılan:* evet.
40. Q48 – Ek ürün uyarısı "Başka bir ürün ekleyin ya da ücretsiz Click & Collect seçin" diyor. *Varsayılan:* evet.
41. Q49 – "Add for £1" önerileri, ödeme simgeleri, resmi tatiller henüz yok. *Varsayılan:* sonraki iş.
42. Q56 – Müşteri hesap e-postasını çevrimiçi değiştiremez ("mağazayı arayın"). *Varsayılan:* evet.
43. Q57 – Toptan başvuru formunda Turnstile yok (giriş zorunlu). *Varsayılan:* yok.
44. Q58 – Tamir zamanı tercihi: isteğe bağlı tarih + sabah/öğleden sonra. *Varsayılan:* evet.

**Ödemeler ve e-posta (E2)**
45. Q30 – Click & Collect meta veri anahtarları `click-collect.md` sözleşmesine göre. *Varsayılan:* evet.
46. Q31 – Düşük stok e-postası yeniden sipariş seviyesini ürün bilgisinden okuyor. *Varsayılan:* evet.
47. Q32 – Günde (Londra saatiyle) tek düşük stok e-postası. *Varsayılan:* evet.
48. Q33 – Kart blokesi tekrar denemeden sonra da kaldırılamazsa? *Varsayılan:* yalnızca sipariş/ödeme numarası loglanır (banka blokeyi kendisi kaldırır).
49. Q34 – 7 gün geçmiş ama ödemesi zaten çekilmiş sipariş? *Varsayılan:* otomatik iptal/iade yok, uyarı loglanır.
50. Q36 – Ücretsiz kargo indirimler düşüldükten sonraki tutara (KDV dahil) göre. *Varsayılan:* evet.
51. Q37 – Eşikler Settings → "Shop settings" sayfasından değiştiriliyor. *Varsayılan:* evet.
52. Q38 – Otomatik `ADDONS-3-FOR-2` kampanyası üretimde de oluşturulsun mu? *Varsayılan:* evet.
53. Q39 – Kampanya "£1 Deals" kategorisine, sepet kuralı `is_addon_item` işaretine bakıyor; ikisi uyumlu tutulmalı. *Varsayılan:* evet.
54. Q40 – Düşük stok = stok − rezerve ≤ yeniden sipariş seviyesi, 08:00'de; yayında olmayanlar hariç. *Varsayılan:* evet.
55. Q50 – `hello@technest.co.uk` bugün nerede? MX değişince tüm alan adı e-postası sunucumuza gelir. *Varsayılan:* sunucumuz yönetir; değiştirmeden önce kontrol edin.
56. Q51 – `orders@` yalnızca IMAPS 993 ile okunuyor; gönderme portları kapalı. *Varsayılan:* kapalı.
57. Q52 – DMARC 2–4 hafta `p=none`, sonra `quarantine`. *Varsayılan:* evet.
58. Q53 – İadeler yalnızca admin sipariş sayfasından (Stripe panelinden değil). *Varsayılan:* evet.
59. Q61 – Toptan olaylarında müşteri e-postası ve mağaza uyarısı ayrı çalışıyor. *Varsayılan:* ayrı kalsın.
60. Q62 – Sipariş düğmesi "Place order and pay £X". *Varsayılan:* evet.
61. Q63 – Stripe ödeme yolu gerçek test anahtarlarıyla çalıştırılmadı. *Varsayılan:* test anahtarları gelince README'ye göre çalıştırın.
62. Q66 – Kargo siparişinde ödeme çekilemezse ne yapılacak? *Varsayılan:* "göndermeyin, müşteriyi arayın".
63. Q67 – Stripe'ta Apple Pay / Google Pay açılsın mı? *Varsayılan:* açık soru.

**Admin ve Quick Add (E4)**
64. Q41 – Quick Add için üretimde `ANTHROPIC_API_KEY` gerekli (yoksa öneri olmadan çalışır). *Varsayılan:* anahtarı siz sağlayın; kullanıcı başına saatte 60 analiz.
65. Q42 – Önerilen fiyat otomatik dolmaz, vape görünümlü ürün taslak olarak bile reddedilir, UKCA/CE için "etiketi kontrol ettim" onayı gerekir. *Varsayılan:* evet.
66. Q54 – Panoda "Mark ready" tek dokunuş, yalnızca "Collected" onay ister. *Varsayılan:* evet.
67. Q55 – Admin'de 44 px düğmeler ve 16 px yazı. *Varsayılan:* evet.
