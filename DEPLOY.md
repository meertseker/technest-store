# Tech Nest: Kurulum ve Yayına Alma Rehberi (DEPLOY.md)

Bu rehber lead (proje sahibi) içindir. Sunucuyu sıfırdan kurmayı, ilk yayını, yedeklemeyi,
geri yüklemeyi ve izlemeyi adım adım anlatır. Komutlar kopyala-yapıştır içindir.
Kod ve dosya adları İngilizcedir; açıklamalar Türkçedir.

> **Önemli kural:** Bu rehberdeki bulut işlemleri (Hetzner, Cloudflare, R2, GHCR, Sentry,
> UptimeRobot) para veya kalıcı değişiklik içerir. Bunları yalnızca lead yapar. Mühendisler
> (E1–E4) yalnızca dosyaları hazırlar.

> **Vercel önizlemesi geçicidir, üretim değildir.** Mağazanın şu an Vercel'de gördüğünüz hali
> (`technest-store-preview` projesi + Vercel Sandbox içindeki backend) yalnızca sahibin geliştirme
> sırasında siteye tıklayıp bakabilmesi içindir: demo veri, Stripe yok, e-posta gitmez, backend en
> fazla 45 dakikada bir kapanır. Gerçek müşteri verisi veya canlı anahtar oraya **asla** girilmez.
> Üretim bu rehberdeki Hetzner + Docker Compose + Caddy + Cloudflare kurulumudur. Ayrıntı:
> [docs/preview-vercel.md](docs/preview-vercel.md).

## İçindekiler

1. Genel mimari
2. Hetzner sunucuları
3. IP itibarı (artık gerekmiyor)
4. Cloudflare DNS, proxy ve R2
5. Gizli bilgiler (secrets)
6. İlk yayın (first deploy)
7. Sonraki yayınlar ve geri alma (rollback)
8. Yedekleme ve geri yükleme
9. İzleme: Sentry ve UptimeRobot
10. Cloudflare hız sınırı (rate limit) kuralları
11. E-posta: Resend ve Cloudflare Email Routing
12. Canlı öncesi kontrol listesi (pre-launch)
13. Canlıya geçiş (cutover) kontrol listesi

---

## 1. Genel mimari

Tek bir Hetzner sunucusu (boyut için bölüm 2.1), Docker Compose ile şu servisleri çalıştırır:

| Servis | Görevi | Dışarı açık mı? |
|---|---|---|
| `caddy` | HTTPS ve yönlendirme (80/443) | Evet (tek giriş noktası) |
| `server` | Medusa API + yönetim paneli (`MEDUSA_WORKER_MODE=server`) | Hayır (Caddy üzerinden) |
| `worker` | Medusa arka plan işleri (`MEDUSA_WORKER_MODE=worker`) | Hayır |
| `storefront` | Next.js mağaza | Hayır (Caddy üzerinden) |
| `postgres` | Veritabanı (Postgres 16) | Hayır |
| `redis` | Kuyruk, olaylar, kilitler (Redis 7) | Hayır |
| `backup` | Her gece 03:15'te veritabanı yedeği → R2 | Hayır |

Sunucuda **çalışmayan**, dışarıdan alınan iki hizmet (lead kararı, 2026-10-02,
`docs/adr/0004-hosted-background-removal-and-email.md`):

| Hizmet | Görevi | Anahtar |
|---|---|---|
| **fal.ai** | Ürün fotoğrafında arka plan silme (BiRefNet). Yalnızca fotoğraf gider, yalnızca maske kullanılır; orijinal saklanır | `FAL_KEY` |
| **Resend** | Mağazanın tüm e-postalarını SMTP ile gönderir (bölüm 11) | `SMTP_PASS` |

Alan adları:

- `technest.co.uk` → mağaza (`www.` adresi buraya yönlenir)
- `api.technest.co.uk` → Medusa API ve Stripe webhook'ları
- `admin.technest.co.uk` → yönetim paneli (`/app`)

İmajlar (Docker image) **GitHub Actions** üzerinde derlenir ve **GHCR**'ye gönderilir.
Sunucuda hiçbir şey derlenmez; sunucu yalnızca imajları çeker (`docker compose pull`).

Depodaki ilgili dosyalar:

- `docker-compose.yml`: üretim servisleri
- `infra/staging/docker-compose.staging.yml`: staging (CX23) için daha küçük bellek sınırları
- `Caddyfile`: HTTPS ve yönlendirmeler
- `.env.production.template`: sunucudaki `.env` dosyasının şablonu
- `.github/workflows/ci.yml`: her push'ta test ve derleme
- `.github/workflows/deploy.yml`: imaj derleme + yayın (**kapalı**, bkz. bölüm 6)
- `infra/backup/`: yedekleme konteyneri
- `docs/ops/uptime-and-sentry.md`: izleme kontrol listesi

---

## 2. Hetzner sunucuları

### 2.1 Staging sunucusu (geçici CX23)

Staging, canlıdan önce her şeyi denediğimiz geçici sunucudur. Canlıya geçtikten sonra
silinebilir. Geri yükleme tatbikatı (bölüm 8.4) için de bu boyutta yeni bir sunucu açılır.

1. https://console.hetzner.cloud → proje oluşturun: `technest`.
2. **Security → SSH Keys**: kendi açık anahtarınızı ekleyin (`~/.ssh/id_ed25519.pub`).
   Yoksa: `ssh-keygen -t ed25519 -C "lead@technest"`.
3. **Add Server**:
   - Location: **Falkenstein** veya **Nuremberg** (Almanya; UK'ye yakın ve ucuz). Londra yok.
   - Image: **Ubuntu 24.04**
   - Type: **Cost-Optimized → x86 → CX23** (2 vCPU, 4 GB) staging için. Üretim için: staging'de
     `docker stats` ile gerçek bellek kullanımına bakın; 3 GB'ın rahat altındaysa CX23 yeter
     (`docker-compose.staging.yml` sınırlarıyla), değilse **CX33** (4 vCPU, 8 GB). Sunucu sonradan
     Hetzner'de "Rescale" ile büyütülebilir. Arm64 seçmeyin (imajlar x86)
   - Networking: IPv4 + IPv6 açık
   - SSH key: az önce eklediğiniz anahtar
   - Backups: üretimde **açın** (sunucu fiyatının +%20'si; günlük snapshot, 7 adet tutulur).
     Staging'de kapalı kalabilir.
   - Name: `technest-staging` / `technest-prod`
4. **Firewall** oluşturun (`technest-fw`) ve sunucuya bağlayın. Gelen (inbound) kurallar:
   - TCP 22: yalnızca kendi IP adresiniz
   - TCP 80, TCP 443, UDP 443: herkes (Cloudflare proxy'si buradan gelir)
   - Diğer her şey kapalı.

### 2.2 Sunucu hazırlığı (her iki sunucuda aynı)

```bash
ssh root@SUNUCU_IP

# Güncellemeler ve otomatik güvenlik yamaları
apt update && apt -y upgrade
apt -y install unattended-upgrades fail2ban
dpkg-reconfigure -plow unattended-upgrades

# Docker (resmi betik)
curl -fsSL https://get.docker.com | sh

# Yayın kullanıcısı (GitHub Actions bununla bağlanır)
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh /opt/technest
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh /opt/technest
chmod 700 /home/deploy/.ssh

# Root ile ve parola ile SSH girişini kapatın
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/; s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# Swap (bellek taşmasına karşı güvenlik payı)
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Bundan sonra `ssh deploy@SUNUCU_IP` ile bağlanın.

### 2.3 GitHub Actions için yayın anahtarı

Kendi bilgisayarınızda, yalnızca yayın için ayrı bir anahtar üretin:

```bash
ssh-keygen -t ed25519 -f technest_deploy -C "github-actions-deploy" -N ""
ssh-copy-id -i technest_deploy.pub deploy@SUNUCU_IP
ssh-keyscan SUNUCU_IP   # çıktısı SSH_KNOWN_HOSTS secret'ı olacak
```

`technest_deploy` (özel anahtar) GitHub'a secret olarak girilir (bölüm 5.3), sonra
bilgisayarınızdan silinebilir.

---

## 3. IP itibarı (artık gerekmiyor)

E-postalar artık bu sunucudan değil **Resend** üzerinden gider (bölüm 11). Bu yüzden sunucunun IP
itibarı (Spamhaus, MXToolbox), Reverse DNS (PTR) kaydı ve Hetzner'in giden port 25 engeli e-posta
teslimini **etkilemez**. Yapılacak bir şey yok.

---

## 4. Cloudflare DNS, proxy ve R2

### 4.1 Alan adını Cloudflare'e taşıma

1. https://dash.cloudflare.com → **Add a site** → `technest.co.uk` → Free plan.
2. Cloudflare'in verdiği iki nameserver'ı alan adını aldığınız firmada (registrar) girin.
3. Durum "Active" olunca devam edin (birkaç dakika ile 24 saat sürebilir).

### 4.2 DNS kayıtları

| Tür | Ad | Değer | Proxy |
|---|---|---|---|
| A | `technest.co.uk` (@) | ÜRETİM_IPv4 | Turuncu bulut (Proxied) |
| AAAA | @ | ÜRETİM_IPv6 | Proxied |
| CNAME | `www` | `technest.co.uk` | Proxied |
| A | `api` | ÜRETİM_IPv4 | Proxied |
| A | `admin` | ÜRETİM_IPv4 | Proxied |
| A | `staging` | STAGING_IPv4 | Proxied |
| A | `api.staging` | STAGING_IPv4 | Proxied |
| A | `admin.staging` | STAGING_IPv4 | Proxied |

E-posta kayıtları (Resend'in DKIM/SPF kayıtları, DMARC, Cloudflare Email Routing) için bölüm 11'e bakın.

> Not: `api.staging.technest.co.uk` gibi iki seviyeli alt alan adları Cloudflare'in ücretsiz
> Universal SSL sertifikasına dahil değildir. Staging için bunun yerine tek seviyeli adlar
> kullanın: `SHOP_DOMAIN=staging.technest.co.uk` yerine staging'i ayrı bir alan adıyla (örneğin
> ucuz bir `technest-staging.co.uk`) kurmak en kolayıdır. Ya da staging kayıtlarını
> **DNS only** yapın; Caddy o zaman kendi Let's Encrypt sertifikasını alır.

### 4.3 SSL/TLS ayarları

- **SSL/TLS → Overview**: mod **Full (strict)**. (Caddy sunucuda gerçek sertifika alır.)
- **SSL/TLS → Edge Certificates**: "Always Use HTTPS" açık, "Minimum TLS Version" 1.2.
- **Speed → Optimization**: "Rocket Loader" **kapalı** (checkout sayfasındaki güvenlik
  politikasını (CSP) bozar). "Auto Minify" kapalı.
- **Caching → Configuration**: varsayılan. **Cache Rules** ile `api.` ve `admin.` alt alan
  adlarında "Bypass cache" kuralı ekleyin.
- **Security → Bots**: "Bot Fight Mode" **kapalı** (Stripe webhook'larını engelleyebilir).
- **Turnstile** (robot kontrolü, tamir randevu formu): Dashboard → Turnstile → **Add widget** →
  alan adı `technest.co.uk` (staging için staging alan adını da ekleyin), mod **Managed**. İki anahtar verir:
  - **Site key** → storefront, derleme sırasında: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (GitHub **variable**, ortam başına; site key gizli değildir, 5.3).
  - **Secret key** → backend: `TURNSTILE_SECRET_KEY` (sunucu `.env`, 5.1).

  Secret key yoksa backend açılır ama **her tamir randevusu reddedilir** ("Turnstile verification
  failed") ve logda hata görünür. Toptan (trade) başvuru formu Turnstile kullanmaz; müşteri girişi ister.

  Anahtarlar zaten bağlı: `docker-compose.yml` secret key'i server/worker'a geçirir, `deploy.yml` site
  key'i storefront imajına derleme argümanı olarak verir.

### 4.4 R2 (dosya ve yedek depolama)

İki bucket açın:

1. **R2 → Create bucket** → `technest-media` (ürün fotoğrafları). Location: Automatic (EU).
   - **Settings → Public access → Custom domain**: `media.technest.co.uk` bağlayın.
     Bu adres `S3_FILE_URL` olur (`https://media.technest.co.uk`) ve storefront'un
     `NEXT_PUBLIC_IMAGE_HOSTNAME` değeri `media.technest.co.uk` olur.
2. **R2 → Create bucket** → `technest-backups` (veritabanı yedekleri). **Public access kapalı.**
   - **Settings → Object lifecycle rules → Add rule**: "Delete objects 30 days after upload".
     (Yedekleme betiği de 30 günden eski dosyaları siler; kural ikinci güvenlik katmanıdır.)
3. **R2 → Manage R2 API Tokens** → iki ayrı token:
   - `technest-media-rw`: "Object Read & Write", yalnızca `technest-media` bucket'ı.
     → `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
   - `technest-backups-rw`: "Object Read & Write", yalnızca `technest-backups` bucket'ı.
     → `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`
   - Endpoint (ikisinde de aynı): `https://HESAP_ID.r2.cloudflarestorage.com` → `S3_ENDPOINT`

---

## 5. Gizli bilgiler (secrets)

**Hiçbir gizli bilgi git'e girmez.** İki yerde tutulur:

### 5.1 Sunucuda: `/opt/technest/.env`

Depodaki `.env.production.template` dosyasını sunucuya kopyalayıp doldurun:

```bash
scp .env.production.template deploy@SUNUCU_IP:/opt/technest/.env
ssh deploy@SUNUCU_IP
cd /opt/technest && chmod 600 .env && nano .env
```

Rastgele değerler üretmek için (her biri için ayrı çalıştırın):

```bash
openssl rand -hex 32
```

`POSTGRES_PASSWORD` **yalnızca hex** olmalıdır (yukarıdaki komut hex üretir), çünkü
bağlantı adresine (`DATABASE_URL`) kodlanmadan yazılır.

Aşağıdaki tablo `.env.production.template`, `docker-compose.yml` ve `apps/backend/.env.template` ile
karşılaştırıldı (2026-09-30). "Zorunlu" = boşsa compose başlamaz ya da özellik çalışmaz.

**Temel**

| Değişken | Zorunlu mu | Nereden / not |
|---|---|---|
| `SHOP_DOMAIN` | Evet | `technest.co.uk` (staging'de staging alan adı). `api.` ve `admin.` bundan türetilir |
| `GHCR_OWNER` | Evet | GitHub kullanıcı/organizasyon adı, **küçük harf** (`meertseker`) |
| `IMAGE_TAG` | — | deploy.yml yazar; elle değiştirmeyin (yalnızca elle geri alma, bölüm 7) |
| `ACME_EMAIL` | Hayır | Let's Encrypt bildirimleri; varsayılan `hello@technest.co.uk` |
| `COMPOSE_FILE` | — | yalnızca staging / tatbikat: `docker-compose.yml:docker-compose.staging.yml` |
| `POSTGRES_PASSWORD` | Evet | `openssl rand -hex 32` (**yalnızca hex**) |
| `JWT_SECRET`, `COOKIE_SECRET` | Evet | `openssl rand -hex 32`, ikisi farklı |

**Dosyalar ve yedek (R2, bölüm 4.4)**

| Değişken | Zorunlu mu | Nereden / not |
|---|---|---|
| `S3_FILE_URL` | Evet | `https://media.technest.co.uk` |
| `S3_ENDPOINT` | Evet | `https://HESAP_ID.r2.cloudflarestorage.com` (yedek de aynı endpoint'i kullanır) |
| `S3_BUCKET` | Evet | `technest-media` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Evet | `technest-media-rw` token'ı |
| `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | Yedek için evet | `technest-backups-rw` token'ı. Boşsa yedek alınmaz ve `backup` unhealthy olur |
| `BACKUP_BUCKET` | Hayır | varsayılan `technest-backups` |
| `BACKUP_AT`, `BACKUP_RETENTION_DAYS` | Hayır | varsayılan `03:15` (Londra) ve `30` gün |

**Ödeme (E2, bölüm 5.4)**

| Değişken | Zorunlu mu | Nereden / not |
|---|---|---|
| `STRIPE_API_KEY` | Evet | staging `sk_test_…`, canlı `sk_live_…`. Üretimde yoksa backend **açılmaz** |
| `STRIPE_WEBHOOK_SECRET` | Evet | `whsec_…`, Stripe'taki webhook uç noktasından (5.4). Üretimde yoksa backend **açılmaz** |
| `KLARNA_MIN_BASKET_PENCE` | Hayır | Yalnızca yedek varsayılan (3000). Asıl değer admin → Settings → Shop settings. Compose bunu geçirmez; gerek de yok |

**E-posta (Resend, bölüm 11)**

| Değişken | Zorunlu mu | Nereden / not |
|---|---|---|
| `SMTP_PASS` | Evet | Resend **API key** (`re_…`), bölüm 11.2 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS` | Hayır | Varsayılanlar Resend içindir: `smtp.resend.com`, `587`, `resend`, `false`, `true`. Başka bir SMTP sağlayıcısına geçerseniz bunları `.env`'de değiştirin |
| `MAIL_FROM` | Hayır | varsayılan `Tech Nest <orders@SHOP_DOMAIN>`. Adresin alan adı Resend'de **doğrulanmış** olmalı |
| `MAIL_REPLY_TO`, `SHOP_NOTIFY_EMAIL` | Hayır | ikisi de varsayılan `hello@technest.co.uk`. Dükkan bildirimleri (yeni sipariş, trade, tamir, düşük stok) `SHOP_NOTIFY_EMAIL`'e gider |
| `STOREFRONT_URL` | — | compose `https://<SHOP_DOMAIN>` olarak kendisi verir; `.env`'e yazmayın |

**Fotoğraf ve Hızlı Ekle (E4)**

| Değişken | Zorunlu mu | Nereden / not |
|---|---|---|
| `FAL_KEY` | Fotoğraf için evet | https://fal.ai/dashboard/keys → **Add key**. Arka plan silme fal.ai'de çalışır. Boşsa mağaza çalışır ama fotoğraf işleme kapalıdır (admin nedenini gösterir, orijinal fotoğraf saklanır). Yalnızca sunucuda; tarayıcıya gitmez, loglanmaz. fal hesabına bakiye yükleyin; bakiye biterse fotoğraf işleme durur |
| `ANTHROPIC_API_KEY` | Hayır | https://console.anthropic.com → API Keys. Boşsa Hızlı Ekle yapay zekâ önerisi olmadan çalışır. Yalnızca sunucuda; tarayıcıya gitmez, loglanmaz. Console'da aylık harcama sınırı koyun |
| `QUICK_ADD_AI_LIMIT_PER_HOUR` | Hayır | admin kullanıcısı başına saatte fotoğraf analizi, varsayılan `60` |
| `QUICK_ADD_AI_TIMEOUT_MS` | Hayır | deneme başına Claude zaman aşımı, varsayılan `60000` (compose geçirir) |

**Güvenlik ve izleme**

| Değişken | Zorunlu mu | Nereden / not |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | Evet | bölüm 4.3. ⚠ Compose şu an bunu backend'e geçirmiyor (4.3'teki not) [LEAD?] |
| `SENTRY_DSN_BACKEND` | Hayır | bölüm 9.1; compose `server`/`worker`'a `SENTRY_DSN` olarak verir. Boşsa Sentry kapalı |
| `SENTRY_DSN_STOREFRONT` | Hayır | bölüm 9.1 (sunucu tarafı). Tarayıcı DSN'i ayrı: GitHub secret `NEXT_PUBLIC_SENTRY_DSN` |

**Üretimde asla kullanılmayanlar:** `SEED_DEMO_DATA` (demo ürünler; üretimde tanımsız kalır),
`LOW_STOCK_THRESHOLD` (yalnızca ürün özelliği olmayan ürünler için yedek; varsayılan 3, compose geçirmez),
`TECHNEST_TEST_PAYMENT_PROVIDER` (yalnızca testler). Geliştirme değerleri (`supersecret`,
`1x0000…AA` Turnstile test anahtarı, `preview-only-not-a-secret`) üretime **asla** kopyalanmaz.

GHCR'den imaj çekebilmek için sunucuda bir kez giriş yapın (GitHub → Settings → Developer
settings → Personal access tokens (classic) → yalnızca `read:packages` yetkisi):

```bash
echo GITHUB_TOKEN_READ_PACKAGES | docker login ghcr.io -u GITHUB_KULLANICI --password-stdin
```

### 5.2 Yönetici hesabı

İlk yayından sonra bir kez:

```bash
cd /opt/technest
docker compose --profile ops run --rm migrate /app/apps/backend/node_modules/.bin/medusa user -e SAHIP_EPOSTA -p GECICI_PAROLA
```

Sahip ilk girişte parolasını değiştirir. Publishable API key: admin → Settings →
Publishable API Keys → mevcut anahtarı kopyalayın (storefront imajı için gerekir, 5.3).

### 5.3 GitHub'da: Environments ve secrets

GitHub → depo → **Settings → Environments** → iki ortam: `staging` ve `production`.
`production` için **Required reviewers** = siz (her canlı yayın onayınızı bekler).

Her ortamda:

| Tür | Ad | Değer |
|---|---|---|
| Secret | `SSH_HOST` | sunucu IP'si |
| Secret | `SSH_USER` | `deploy` |
| Secret | `SSH_PRIVATE_KEY` | `technest_deploy` dosyasının içeriği |
| Secret | `SSH_KNOWN_HOSTS` | `ssh-keyscan` çıktısı |
| Secret | `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | admin'den (5.2) |
| Secret | `NEXT_PUBLIC_STRIPE_KEY` | Stripe publishable key (`pk_test_…`, canlıda `pk_live_…`) |
| Secret | `NEXT_PUBLIC_SENTRY_DSN` | storefront Sentry DSN (isteğe bağlı) |
| Variable | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key (4.3), deploy.yml bunu storefront imajına derler |
| Variable | `SHOP_DOMAIN` | `technest.co.uk` veya staging alan adı |
| Variable | `NEXT_PUBLIC_IMAGE_HOSTNAME` | `media.technest.co.uk` |

Depo düzeyinde (Settings → Secrets and variables → Actions → **Variables**):
`DEPLOY_ENABLED` = `true`. **Bu değişken yoksa deploy.yml hiçbir şey yapmaz.**

`NEXT_PUBLIC_…` değerleri storefront imajına **derleme sırasında** gömülür: birini değiştirdikten
sonra yayını bir kez daha çalıştırın. Staging ve production ayrı imaj alır.

### 5.4 Stripe: canlı anahtarlar ve webhook (E2)

Önce staging'de **test modu** (`sk_test_…`, `pk_test_…`), canlıya geçişte **live mode**.
Ayrıntılı kurallar: `docs/contracts/payments.md`.

1. https://dashboard.stripe.com → sağ üstte **Test mode** kapalı (canlı için) → **Developers → API keys**:
   - Publishable key `pk_live_…` → GitHub secret `NEXT_PUBLIC_STRIPE_KEY` (production ortamı)
   - Secret key `sk_live_…` → sunucu `.env`: `STRIPE_API_KEY`
2. **Developers → Webhooks → Add endpoint**:
   - URL: `https://api.technest.co.uk/hooks/payment/stripe_stripe`
   - Olaylar: `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`,
     `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.processing`,
     `payment_intent.requires_action`, `payment_intent.partially_funded`
   - Kaydedince **Signing secret** (`whsec_…`) → `.env`: `STRIPE_WEBHOOK_SECRET`.
     Test modu ve canlı mod ayrı uç nokta ve ayrı secret ister.
3. **Settings → Payment methods**: Kart ve **Klarna** açık. (Klarna'yı sepet tutarına göre kod açıp
   kapatır; Stripe'ta kapalıysa hiç görünmez.) [LEAD?] Apple Pay / Google Pay de açılsın mı?
4. `docker compose up -d server worker` → Stripe → Webhooks → uç noktada **Send test webhook**:
   `200` dönmeli. İmzasız istekler `400 Invalid webhook signature` alır (bu normaldir).
5. Siparişi "ödendi" yapan **yalnızca** imzalı webhook'tur. İadeler **yalnızca** admin sipariş
   sayfasından yapılır; Stripe panelinden yapılan iade sisteme geri yansımaz (sahip rehberi,
   `docs/owner/tr/08-orders-and-refunds.md`).

---

## 6. İlk yayın (first deploy)

Önce staging, sonra üretim. Her ikisinde de aynı adımlar:

1. Bölüm 2–5 tamam: sunucu hazır, DNS aktif, `.env` dolu, GHCR girişi yapılmış.
2. Compose dosyalarını sunucuya koyun (deploy.yml de her seferinde kopyalar):
   ```bash
   scp docker-compose.yml Caddyfile deploy@SUNUCU_IP:/opt/technest/
   # yalnızca staging:
   scp infra/staging/docker-compose.staging.yml deploy@SUNUCU_IP:/opt/technest/
   ```
3. GitHub → **Actions → Deploy → Run workflow** → environment: `staging`.
   İş sırası: 3 imaj derlenir (`technest-backend`, `technest-storefront`,
   `technest-backup`; lisans kontrolü dahil) → GHCR'ye gönderilir → sunucuda
   `docker compose pull` → `migrate` (veritabanı tabloları + ilk veriler) → `up -d` →
   sağlık kontrolü. İlk derleme 15–25 dakika sürebilir.
4. Kontrol:
   ```bash
   ssh deploy@SUNUCU_IP 'cd /opt/technest && docker compose ps'
   curl -fsS https://api.SHOP_DOMAIN/health        # "OK"
   curl -fsS https://SHOP_DOMAIN/api/health        # "ok"
   ```
   Tüm servisler `healthy` olmalı.
5. Yönetici hesabını oluşturun (5.2), publishable key'i GitHub secret'ına girin ve
   **storefront imajı bu anahtarı içersin diye yayını bir kez daha çalıştırın**.
6. Duman testi (smoke test): bölüm 12'deki listeyi staging'de yapın.
7. Staging temizse aynı adımları `production` ortamıyla tekrarlayın.

---

## 7. Sonraki yayınlar ve geri alma

- Yayın: GitHub → Actions → Deploy → Run workflow. Her yayın, `main` dalının o anki
  commit'inden imaj üretir; etiket `production-<commit>` biçimindedir.
- **Otomatik geri alma:** yayından sonra 5 dakika içinde sağlık kontrolü geçmezse
  deploy.yml önceki etiketi geri yükler (`.previous_tag`).
- **Elle geri alma:**
  ```bash
  cd /opt/technest
  cat .previous_tag                          # önceki etiket
  sed -i '/^IMAGE_TAG=/d' .env && echo "IMAGE_TAG=ÖNCEKİ_ETİKET" >> .env
  docker compose up -d --remove-orphans
  ```
- **Dikkat:** veritabanı migration'ları geri alınmaz. Migration içeren bir yayın bozuksa,
  eski imaja dönmek yetmeyebilir; o zaman yedekten geri yükleyin (bölüm 8.3). Bu yüzden
  migration içeren yayınlardan önce elle bir yedek alın:
  `docker compose run --rm backup backup.sh`.

---

## 8. Yedekleme ve geri yükleme

### 8.1 Ne yedekleniyor?

| Ne | Nasıl | Nerede | Ne kadar |
|---|---|---|---|
| Veritabanı (siparişler, ürünler, müşteriler) | `backup` servisi, her gece 03:15 (Londra), `pg_dump -Fc` | R2 `technest-backups/db/` | 30 gün |
| Ürün fotoğrafları | Zaten R2'de (`technest-media`) | R2 | süresiz |
| Tüm sunucu diski | Hetzner Backups (günlük snapshot) | Hetzner | 7 gün |
| `.env` (gizli bilgiler) | **Elle**: bir parola yöneticisinde (1Password/Bitwarden) saklayın | — | — |

Redis yedeklenmez: içeriği (kuyruklar, kilitler) geçicidir.

### 8.2 Yedeklerin çalıştığını kontrol

```bash
cd /opt/technest
docker compose ps backup                           # "healthy" olmalı
docker compose logs --tail 20 backup               # "backup: OK technest-2026...dump"
docker compose run --rm backup restore.sh --list   # R2'deki yedekler
docker compose run --rm backup backup.sh           # hemen bir yedek al
```

`backup` servisi, son başarılı yedek 26 saatten eskiyse **unhealthy** olur. UptimeRobot
bunu doğrudan göremez; haftalık rutinde `docker compose ps` bakılır (bölüm 9.3).

### 8.3 Geri yükleme (aynı sunucuda)

```bash
cd /opt/technest
docker compose stop server worker storefront        # yazmaları durdur
docker compose run --rm backup restore.sh --list    # hangi yedek?
docker compose run --rm backup restore.sh latest --yes
#   veya belirli bir dosya: restore.sh technest-20261115T031500Z.dump --yes
docker compose up -d
curl -fsS https://api.technest.co.uk/health
```

### 8.4 Geri yükleme tatbikatı (yeni sunucuda, hafta 6, hedef < 1 saat)

Amaç: sunucu tamamen kaybolursa mağazanın 1 saatten kısa sürede geri geldiğini kanıtlamak.
**Başlangıç saatini not edin.**

1. Yeni bir CX23 açın (bölüm 2.1–2.2, yaklaşık 10 dk).
2. `/opt/technest`'e `docker-compose.yml`, `Caddyfile`, `docker-compose.staging.yml`
   (depoda `infra/staging/` altında) ve parola yöneticisindeki `.env`'i koyun. GHCR girişi yapın.
   `.env`'de **başlatmadan önce** şunları değiştirin (bu sunucu canlı verinin kopyasıyla çalışacak):
   - `SHOP_DOMAIN=` test alan adı (canlı alan adı **değil**)
   - `COMPOSE_FILE=docker-compose.yml:docker-compose.staging.yml` (CX23'ün belleği için)
   - `STRIPE_API_KEY=` ve `STRIPE_WEBHOOK_SECRET=` → staging'in **test** değerleri (`sk_test_…`, `whsec_…`).
     Canlı anahtarla bu kopya gerçek ödemeleri alabilir veya iptal edebilir. Boş bırakmayın:
     backend üretim modunda bu ikisi olmadan açılmaz.
   - `SMTP_HOST=localhost`: gönderim başarısız olur, müşterilere e-posta gitmez. (Boş bırakmak işe
     yaramaz: compose boş değeri `smtp.resend.com` yapar ve gerçek e-posta gider.)
3. Yalnızca veritabanını başlatıp yedeği geri yükleyin:
   ```bash
   docker compose pull
   docker compose up -d postgres redis
   docker compose run --rm backup restore.sh latest --yes
   ```
4. Uygulamayı **worker ve backup olmadan** başlatın:
   `docker compose up -d caddy server storefront`.
   `worker` başlatılmaz (zamanlanmış işler, ör. 7 gün sonra teslim alınmayan siparişin iptali, canlı
   verinin kopyasında çalışmasın); `backup` başlatılmaz (bu sunucunun yedekleri canlı yedek klasörüne
   `technest-*.dump` adıyla yazılır ve "latest" onlardan biri olur). Admin'den fotoğraf yüklemeyin:
   `S3_*` canlı medya bucket'ını gösterir.
   Migration gerekmez; yedek zaten günceldir. Emin olmak için: `docker compose --profile ops run --rm migrate`.
5. Kontrol: `curl https://api.TEST_ALANI/health`, admin'e giriş, son siparişin görünmesi,
   ürün sayısının canlıyla aynı olması.
6. **Bitiş saatini not edin** ve süreyi TEAM_CHAT'e yazın. Sunucuyu silin.

Bu tatbikat şu an **insan onayı bekliyor** (sunucu açmak para gerektirir).

---

## 9. İzleme: Sentry ve UptimeRobot

Ayrıntılı liste: `docs/ops/uptime-and-sentry.md`.

### 9.1 Sentry (ücretsiz plan)

1. https://sentry.io → organizasyon `technest` → iki proje:
   - `technest-backend` (platform: Node.js)
   - `technest-storefront` (platform: Next.js)
2. Her projenin DSN'ini kopyalayın:
   - backend DSN → sunucu `.env`: `SENTRY_DSN_BACKEND` (compose bunu `server` ve `worker`'a `SENTRY_DSN` olarak verir)
   - storefront DSN → sunucu `.env`: `SENTRY_DSN_STOREFRONT` (sunucu tarafı) ve GitHub secret
     `NEXT_PUBLIC_SENTRY_DSN` (tarayıcı tarafı). `NEXT_PUBLIC_…` imaja derleme sırasında gömülür:
     değiştirdikten sonra yayını bir kez daha çalıştırın. `.env` değişikliği için
     `docker compose up -d` yeterlidir.
3. Proje ayarları → **Security & Privacy**: "Data Scrubber" açık, "Prevent Storing of IP Addresses" açık.
   Kodumuz da kişisel verileri (e-posta, ad, adres, telefon, posta kodu, çerez, kart bilgisi,
   Stripe anahtarları, yetki başlıkları, adresteki sorgu parametreleri) göndermeden önce siler;
   bu ikinci katmandır. Tarayıcıda Sentry `/checkout` sayfasında **hiç çalışmaz** (orada yalnızca
   Stripe'ın betiğine izin var).
4. **Alerts**: "A new issue is created" → e-posta sahibine/lead'e.
5. DSN boşsa Sentry tamamen kapalıdır; uygulama normal çalışır.

### 9.2 UptimeRobot (ücretsiz, 5 dakikada bir)

https://uptimerobot.com → **Add New Monitor** (3 adet):

| Ad | Tür | Adres | Beklenen |
|---|---|---|---|
| Mağaza ana sayfa | HTTP(s) | `https://technest.co.uk/` | 200 |
| Ödeme sayfası | HTTP(s) | `https://technest.co.uk/checkout` | **404** (sepet olmadan sayfa ödeme düzeni içinde 404 döner; 5xx = sorun) |
| API sağlık | Keyword | `https://api.technest.co.uk/health` | "OK" içeriyor |

Ödeme sayfası izleyicisinde "Up" sayılacak durum kodlarını ayarlayın
(Advanced → "Up HTTP status codes"): `200-299, 404`.

Stripe webhook adresi için izleyici **eklemeyin**: Medusa her POST'a 200 döner ve imzayı sonra
worker'da kontrol eder; deneme istekleri yalnızca başarısız webhook olayları üretir. Webhook
teslimleri art arda başarısız olursa Stripe hesap sahibine kendisi e-posta gönderir
(Stripe Dashboard → Developers → Webhooks).

Uyarılar: e-posta + (isteğe bağlı) SMS yerine UptimeRobot mobil uygulama bildirimi.

### 9.3 Haftalık kontrol (5 dakika)

```bash
ssh deploy@SUNUCU_IP 'cd /opt/technest && docker compose ps && df -h / && free -h'
```

- Tüm servisler `healthy` mi? (`backup` dahil)
- Disk %80'in altında mı?
- Sentry'de yeni hata var mı?

---

## 10. Cloudflare hız sınırı (rate limit) kuralları

Ücretsiz plan **1 rate limiting kuralına** izin verir (10 saniyelik pencere). Bu yüzden
tüm hassas yolları tek kuralda birleştiriyoruz. Pro plan (ayda ~20 $) alınırsa ayrı kurallar
aşağıda.

**Security → WAF → Rate limiting rules → Create rule**

Kural 1 (ücretsiz plan, tek kural): "Hassas POST istekleri"

- Expression (Edit expression):
  ```
  (http.request.method eq "POST" and (
     (http.host eq "api.technest.co.uk" and (
        starts_with(http.request.uri.path, "/auth/")
        or http.request.uri.path contains "/complete"
        or starts_with(http.request.uri.path, "/store/trade-applications")
        or starts_with(http.request.uri.path, "/store/repair-bookings")
        or starts_with(http.request.uri.path, "/store/customers")
     ))
     or (http.host eq "admin.technest.co.uk" and starts_with(http.request.uri.path, "/auth/"))
  ))
  ```
- Characteristics: IP
- Rate: **10 istek / 10 saniye**
- Action: **Block**, süre 10 saniye (ücretsiz planda sabit)

Stripe webhook yolu (`/hooks/...`) bu kurala **dahil değildir** ve dahil edilmemelidir.

Pro plan varsa ayrı kurallar (daha sıkı):

| Kural | Yol | Sınır | Eylem |
|---|---|---|---|
| Giriş | `POST /auth/customer/emailpass`, `/auth/user/emailpass` | 5 / dakika / IP | Managed Challenge, 10 dk |
| Parola sıfırlama | `POST /auth/*/reset-password` | 3 / 10 dakika / IP | Block, 1 saat |
| Ödeme | `POST /store/carts/*/complete`, `/store/payment-collections/*` | 20 / dakika / IP | Managed Challenge |
| Toptan başvuru | `POST /store/trade-applications` | 3 / saat / IP | Block, 1 saat |
| Tamir randevusu | `POST /store/repair-bookings` | 5 / saat / IP | Block, 1 saat |

Uygulama tarafında da koruma var: tamir randevu formu Turnstile doğrular (E1); toptan başvuru
müşteri girişi ister ve müşteri başına tek bekleyen başvuruya izin verir.

Test: kuralı kaydettikten sonra kendi bilgisayarınızdan
`for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.technest.co.uk/auth/customer/emailpass; done`
→ ilk istekler 401/400, sonrakiler **429** dönmeli.

---

## 11. E-posta: Resend ve Cloudflare Email Routing

Sunucuda e-posta sunucusu **yoktur**. İki ayrı iş var:

| İş | Kim yapar |
|---|---|
| **Gönderme**: mağazanın otomatik e-postaları (sipariş onayı, "siparişiniz hazır", iade, parola sıfırlama, dükkan bildirimleri) | **Resend**, SMTP ile. Gönderen: `orders@technest.co.uk` |
| **Alma**: müşterilerin `hello@technest.co.uk` adresine yazdıkları ve yanıtlar | **Cloudflare Email Routing**: sahibin mevcut posta kutusuna (ör. Gmail) yönlendirir |

Hangi olayda hangi e-postanın gittiği: `docs/contracts/emails.md`. Backend'in kodu değişmedi:
aynı SMTP sağlayıcısı (`smtp`), yalnızca adres Resend'e bakıyor (`docker-compose.yml`).

### 11.1 Sıra (özet)

1. Alan adı Cloudflare'de aktif olmalı (bölüm 4.1).
2. Resend'de alan adını doğrulayın, API key alın (11.2).
3. `.env`'e `SMTP_PASS` yazın, backend'i yeniden başlatın (11.3).
4. Cloudflare Email Routing ile `hello@` adresini yönlendirin (11.4).
5. Teslim testi (11.5).

### 11.2 Resend: alan adı ve API key

1. https://resend.com → hesap açın → **Domains → Add Domain** → `technest.co.uk`, bölge: **eu-west-1 (Ireland)**.
2. Resend birkaç DNS kaydı gösterir (DKIM için TXT, SPF için TXT ve MX; genellikle `send.` alt alan
   adında ve `resend._domainkey` adında). Hepsini Cloudflare → **DNS → Records**'a **aynen** girin
   (TXT/MX kayıtları proxy'lenmez). Kök alan adındaki (`@`) MX kayıtları Email Routing'e aittir (11.4);
   Resend'inkiler alt alan adında olduğu için çakışmaz.
3. Ayrıca bir DMARC kaydı ekleyin: TXT, ad `_dmarc`, değer `v=DMARC1; p=none;`
   (2-4 hafta sorunsuz gönderimden sonra `p=quarantine` yapılabilir).
4. Resend'de **Verify** → durum "Verified" olmalı (birkaç dakika sürebilir).
5. **API Keys → Create API Key**: ad `technest-production`, izin **Sending access**, alan adı
   `technest.co.uk`. Anahtar (`re_…`) yalnızca bir kez gösterilir. Staging için ayrı bir anahtar açın.

### 11.3 Sunucu ayarı

`/opt/technest/.env`:

```bash
SMTP_PASS=re_...                      # Resend API key
MAIL_FROM=Tech Nest <orders@technest.co.uk>
```

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` yazmanıza gerek yok: varsayılanlar `smtp.resend.com`, `587`,
`resend`. Sonra: `docker compose up -d server worker`.

`MAIL_FROM` adresinin alan adı Resend'de doğrulanmış olmalı; değilse Resend e-postayı reddeder.
`orders@` için bir posta kutusu **gerekmez** (yalnızca gönderen adıdır). Müşteri "Yanıtla" derse
e-posta `MAIL_REPLY_TO` adresine (`hello@`) gider.

### 11.4 Gelen posta: Cloudflare Email Routing

1. Cloudflare → `technest.co.uk` → **Email → Email Routing → Get started**.
2. **Custom address**: `hello@technest.co.uk` → **Destination**: sahibin mevcut adresi (ör. Gmail).
   Cloudflare o adrese bir doğrulama e-postası gönderir; sahibi onaylar.
3. Cloudflare gerekli MX ve SPF kayıtlarını kök alan adına kendisi ekler ("Add records and enable").
4. İsterseniz **Catch-all** kuralını da aynı adrese yönlendirin (`orders@`, `postmaster@` vb. için).

> **Önce kontrol edin: `hello@technest.co.uk` şu an nerede?** Email Routing'i açtığınız anda
> `@technest.co.uk` adresine gelen **tüm** e-postalar Cloudflare'e gelir. Alan adında zaten çalışan
> bir posta kutusu (Google Workspace, Outlook, hosting) varsa Email Routing'i **açmayın**; o kutu
> kullanılmaya devam eder ve yalnızca 11.2'deki Resend kayıtları eklenir.

**Sahibin `hello@` adresinden yanıt yazması** (isteğe bağlı): Email Routing yalnızca alır, göndermez.
Gmail → Ayarlar → **Hesaplar → "Postaları şu adresten gönder" → Başka bir e-posta adresi ekle**:
ad `Tech Nest`, adres `hello@technest.co.uk`, SMTP sunucusu `smtp.resend.com`, port `465` (SSL),
kullanıcı adı `resend`, parola: bu iş için açılmış ayrı bir Resend API key. Bundan sonra Gmail'de
gönderen olarak `hello@technest.co.uk` seçilebilir. Bunu yapmazsanız sahibi kendi adresinden yanıtlar.

### 11.5 Teslim testi

1. Staging'de (veya canlıda küçük bir siparişle) sipariş verin → sipariş onayı kendi Gmail adresinize
   gelmeli. Gmail'de e-postayı açın → ⋮ → **Show original**: `SPF: PASS`, `DKIM: PASS`,
   `DMARC: PASS` görmelisiniz. Spam klasörüne düşmemeli.
2. https://www.mail-tester.com → verdiği adrese mağazadan bir e-posta gönderin (ör. o adresle bir
   müşteri hesabı açıp parola sıfırlama isteyin) → puan **9/10 veya üzeri** olmalı.
3. Gelen posta: kendi adresinizden `hello@technest.co.uk`'ya yazın → sahibin kutusuna düşmeli.
4. Resend → **Emails**: gönderilen her e-posta ve durumu (delivered / bounced) burada görünür.

Sorun giderme:

- Backend logunda `Invalid login` / `535`: `SMTP_PASS` yanlış ya da anahtar silinmiş.
- Resend "domain is not verified": 11.2'deki DNS kayıtları eksik ya da `MAIL_FROM` başka bir alan adında.
- Backend loglarında yalnızca bildirim kimliği ve şablon adı görünür, alıcı adresi görünmez
  (kişisel veri kuralı).

### 11.6 Sınırlar ve yedek plan

- Resend'in ücretsiz planında günlük ve aylık gönderim sınırı vardır (güncel değerler:
  https://resend.com/pricing). Sipariş sayısı sınıra yaklaşırsa ücretli plana geçin; sınır aşılırsa
  e-postalar reddedilir, siparişler etkilenmez.
- Başka bir sağlayıcıya geçmek (Brevo, Postmark, Amazon SES): kod değişmez. `.env`'de `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` değiştirilir, yeni sağlayıcının DNS kayıtları girilir.

---

## 12. Canlı öncesi kontrol listesi (pre-launch)

Geçiş gününden **önce**, staging'de ve sonra üretim sunucusunda tek tek işaretleyin. Bir madde
başarısızsa canlıya geçmeyin.


**Stripe (5.4)**
- [ ] `.env`'de `STRIPE_API_KEY=sk_live_…`, GitHub `production` ortamında `NEXT_PUBLIC_STRIPE_KEY=pk_live_…`
      (canlı anahtarlar yalnızca `production`'da; staging'de test anahtarları)
- [ ] Canlı webhook uç noktası `https://api.technest.co.uk/hooks/payment/stripe_stripe`, 7 olay seçili,
      `STRIPE_WEBHOOK_SECRET` canlı uç noktanın `whsec_…` değeri
- [ ] "Send test webhook" → 200; Cloudflare'de `/hooks/` hız sınırı ve bot kontrolü dışında (bölüm 10)
- [ ] Stripe'ta Klarna açık; staging'de £30 altı sepette Klarna **görünmüyor**, £30 üstünde görünüyor

**Turnstile (4.3)**
- [ ] Canlı alan adı için widget var; secret `.env`'de, site key GitHub secret'ında
- [ ] Sitede tamir formu gönderilebiliyor; admin → Repair bookings'te görünüyor. Backend logunda
      "TURNSTILE_SECRET_KEY is not set" **yok**

**Hızlı Ekle (Quick add)**
- [ ] `ANTHROPIC_API_KEY` girildi, Anthropic Console'da aylık harcama sınırı ayarlı
- [ ] Admin → Quick add'de "AI suggestions are switched off" uyarısı **yok**; telefonla bir fotoğraf
      çekince öneri 30 saniye içinde geliyor

**E-posta: Resend ve DNS (bölüm 11)**
- [ ] Resend'de alan adı "Verified"; `SMTP_PASS` (API key) `.env`'de; DMARC kaydı var (11.2, 11.3)
- [ ] mail-tester.com **9/10 veya üzeri**; Gmail'de SPF/DKIM/DMARC PASS (11.5)
- [ ] Cloudflare Email Routing açık: `hello@`'ya yazılan e-posta sahibin kutusuna düşüyor (11.4)
- [ ] `hello@technest.co.uk`'a dükkan bildirimleri geliyor (yeni sipariş, trade, tamir, 08:00 düşük stok)

**R2 (4.4)**
- [ ] `technest-media` herkese açık, `media.technest.co.uk` bağlı; admin'den yüklenen bir fotoğraf
      bu adresten açılıyor ve storefront'ta görünüyor (`NEXT_PUBLIC_IMAGE_HOSTNAME` doğru)
- [ ] `technest-backups` **kapalı** (public access yok), 30 gün kuralı var; iki ayrı token

**Sentry (9.1)**
- [ ] `SENTRY_DSN_BACKEND`, `SENTRY_DSN_STOREFRONT` `.env`'de; `NEXT_PUBLIC_SENTRY_DSN` GitHub'da
- [ ] Data Scrubber ve "Prevent Storing of IP Addresses" açık; "new issue" uyarısı lead'e gidiyor

**Yedekler (bölüm 8)**
- [ ] `docker compose run --rm backup backup.sh` → "backup: OK"; `restore.sh --list` dosyayı gösteriyor
- [ ] Geri yükleme tatbikatı **gerçekten yapıldı** (8.4), süre < 1 saat, sonuç TEAM_CHAT'te
- [ ] Hetzner Backups açık; `.env` parola yöneticisinde

**Fotoğraf: fal.ai**
- [ ] `FAL_KEY` `.env`'de; fal hesabında bakiye var (https://fal.ai/dashboard/billing)
- [ ] Admin'de bir ürün fotoğrafı işleyin: arka plan beyaz, ürün değişmemiş, orijinal dosya duruyor.
      Admin → Product photo kutusunda "Photo processing is switched off" uyarısı **yok**
- [ ] Sunucu belleği: `docker stats --no-stream` → toplam kullanım sunucu belleğinin rahat altında

**Genel**
- [ ] `SEED_DEMO_DATA` üretimde tanımsız; admin'de demo ürün yok
- [ ] Sahip hesabı açıldı (5.2), sahip parolasını değiştirdi; sahip rehberleri (`docs/owner/tr/`) kendisine verildi
- [ ] Vercel önizlemesi üretimle karıştırılmıyor: canlı anahtar ya da gerçek veri orada yok ([docs/preview-vercel.md](docs/preview-vercel.md))

---

## 13. Canlıya geçiş (cutover) kontrol listesi (hafta 8)

Lead ve E4 birlikte yapar.

**Bir gün önce**
- [ ] Bölüm 12'deki canlı öncesi listenin tamamı işaretli
- [ ] Staging'de tam duman testi geçti (aşağıdaki liste)
- [ ] Geri yükleme tatbikatı yapıldı, süre < 1 saat (bölüm 8.4)
- [ ] Stripe **canlı** anahtarlar `.env`'de ve GitHub secret'ında; canlı webhook uç noktası
      Stripe'ta tanımlı: `https://api.technest.co.uk/hooks/payment/stripe_stripe`
- [ ] E-posta: mail-tester.com puanı 9/10 veya üzeri
- [ ] UptimeRobot 3 izleyici yeşil, Sentry DSN'ler girili
- [ ] Hetzner Backups açık
- [ ] Cloudflare rate limit kuralı açık

**Geçiş günü**
- [ ] Yedek al: `docker compose run --rm backup backup.sh`
- [ ] Deploy → production
- [ ] Duman testi:
  - [ ] Ana sayfa, cihaz seçimi, ürün sayfası, arama ("type c" → USB-C ürünleri)
  - [ ] Sepet: ücretsiz kargo çubuğu, yalnızca £1 ürünle teslimat engelleniyor
  - [ ] Gerçek kartla küçük bir sipariş (teslimat) → onay e-postası → ödeme otomatik çekildi →
        **admin sipariş sayfasından** iade → "refund issued" e-postası (Stripe panelinden iade yapmayın)
  - [ ] Gerçek kartla Click & Collect siparişi → admin → Click & Collect panosu → "Mark ready"
        (müşteriye kodlu e-posta) → "Collected" → ödeme alındı
  - [ ] Admin: telefondan "Quick add" ile bir ürün (taslak < 60 sn), fotoğraf onayı, ürün sayfasından yayınla
  - [ ] Güvenlik işareti olmayan bir şarj aleti yayınlanamıyor; "vape" başlıklı ürün reddediliyor
  - [ ] Ertesi sabah 08:00'de (düşük stok varsa) düşük stok e-postası geldi
  - [ ] Toptan başvuru → onay e-postası; tamir randevusu → dükkana e-posta
- [ ] `docker compose ps`: hepsi healthy; `backup` gece çalıştı mı (ertesi sabah)
- [ ] İlk hafta: her gün Sentry ve UptimeRobot kontrolü
