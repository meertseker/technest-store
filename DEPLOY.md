# Tech Nest: Kurulum ve Yayına Alma Rehberi (DEPLOY.md)

Bu rehber lead (proje sahibi) içindir. Sunucuyu sıfırdan kurmayı, ilk yayını, yedeklemeyi,
geri yüklemeyi ve izlemeyi adım adım anlatır. Komutlar kopyala-yapıştır içindir.
Kod ve dosya adları İngilizcedir; açıklamalar Türkçedir.

> **Önemli kural:** Bu rehberdeki bulut işlemleri (Hetzner, Cloudflare, R2, GHCR, Sentry,
> UptimeRobot) para veya kalıcı değişiklik içerir. Bunları yalnızca lead yapar. Mühendisler
> (E1–E4) yalnızca dosyaları hazırlar.

## İçindekiler

1. Genel mimari
2. Hetzner sunucuları (CX43 üretim, CX23 staging)
3. IP itibarını kontrol (Spamhaus, MXToolbox)
4. Cloudflare DNS, proxy ve R2
5. Gizli bilgiler (secrets)
6. İlk yayın (first deploy)
7. Sonraki yayınlar ve geri alma (rollback)
8. Yedekleme ve geri yükleme
9. İzleme: Sentry ve UptimeRobot
10. Cloudflare hız sınırı (rate limit) kuralları
11. Mail (E-posta) sunucusu (E2 bölümü)
12. Canlıya geçiş (cutover) kontrol listesi

---

## 1. Genel mimari

Tek bir Hetzner CX43 sunucusu (8 vCPU, 16 GB RAM), Docker Compose ile şu servisleri çalıştırır:

| Servis | Görevi | Dışarı açık mı? |
|---|---|---|
| `caddy` | HTTPS ve yönlendirme (80/443) | Evet (tek giriş noktası) |
| `server` | Medusa API + yönetim paneli (`MEDUSA_WORKER_MODE=server`) | Hayır (Caddy üzerinden) |
| `worker` | Medusa arka plan işleri (`MEDUSA_WORKER_MODE=worker`) | Hayır |
| `storefront` | Next.js mağaza | Hayır (Caddy üzerinden) |
| `postgres` | Veritabanı (Postgres 16) | Hayır |
| `redis` | Kuyruk, olaylar, kilitler (Redis 7) | Hayır |
| `photo-worker` | Arka plan silme (rembg) | Hayır, asla |
| `backup` | Her gece 03:15'te veritabanı yedeği → R2 | Hayır |
| `mailserver` | E-posta (docker-mailserver, E2). `profiles: [mail]`: `--profile mail` ile başlar (bölüm 11) | Evet: 25 (gelen posta) ve 993 (IMAPS). 587 yalnızca iç ağda |

Alan adları:

- `technest.co.uk` → mağaza (`www.` adresi buraya yönlenir)
- `api.technest.co.uk` → Medusa API ve Stripe webhook'ları
- `admin.technest.co.uk` → yönetim paneli (`/app`)
- `mail.technest.co.uk` → e-posta gönderimi

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
   - Type: **CX23** (staging) / **CX43** (üretim)
   - Networking: IPv4 + IPv6 açık
   - SSH key: az önce eklediğiniz anahtar
   - Backups: üretimde **açın** (sunucu fiyatının +%20'si; günlük snapshot, 7 adet tutulur).
     Staging'de kapalı kalabilir.
   - Name: `technest-staging` / `technest-prod`
4. **Firewall** oluşturun (`technest-fw`) ve sunucuya bağlayın. Gelen (inbound) kurallar:
   - TCP 22: yalnızca kendi IP adresiniz
   - TCP 80, TCP 443, UDP 443: herkes (Cloudflare proxy'si buradan gelir)
   - TCP 25 ve 993: herkes (yalnızca e-posta sunucusu açılınca, bölüm 11). 465/587 açmayın
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

## 3. IP itibarını kontrol (Spamhaus, MXToolbox)

Hetzner IP adresleri bazen önceki kullanıcılar yüzünden kara listede olur. Kara listedeki
bir IP'den gönderilen e-postalar (sipariş onayı vb.) spam'e düşer. **Sunucuyu açar açmaz**,
DNS ayarlamadan önce kontrol edin:

1. https://check.spamhaus.org → IPv4 adresini girin. "No issues" görmelisiniz.
2. https://mxtoolbox.com/blacklists.aspx → IPv4 adresini girin. Hepsi yeşil olmalı
   (bir-iki önemsiz listede "listed" olabilir; **Spamhaus, Barracuda, SpamCop** temiz olmalı).
3. IPv6 adresini de aynı şekilde kontrol edin.

**Listelenmişse:** IP'yi değiştirin. Hetzner Console → **Primary IPs** → yeni bir IPv4
oluşturun → sunucuyu kapatın → eski IP'yi ayırıp yenisini bağlayın → sunucuyu açın →
eski IP'yi silin → yeni IP'yi tekrar kontrol edin. Temiz bir IP bulana kadar tekrarlayın.

Son olarak Hetzner Console'da sunucunun **Reverse DNS** (PTR) kaydını
`mail.technest.co.uk` yapın (e-posta teslimi için gerekli).

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
| A | `mail` | ÜRETİM_IPv4 | **DNS only (gri bulut)**: e-posta proxy'den geçemez |
| A | `staging` | STAGING_IPv4 | Proxied |
| A | `api.staging` | STAGING_IPv4 | Proxied |
| A | `admin.staging` | STAGING_IPv4 | Proxied |

E-posta kayıtları (MX, SPF, DKIM, DMARC) için bölüm 11'e bakın.

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
- **Turnstile**: Dashboard → Turnstile → site ekleyin (`technest.co.uk`). Site key
  storefront'a, secret key backend'e gider (`TURNSTILE_SECRET_KEY`).

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

| Değişken | Nereden |
|---|---|
| `SHOP_DOMAIN` | `technest.co.uk` (staging'de staging alan adı) |
| `GHCR_OWNER` | GitHub kullanıcı/organizasyon adı, **küçük harf** (`meertseker`) |
| `IMAGE_TAG` | deploy.yml yazar; elle değiştirmeyin |
| `POSTGRES_PASSWORD`, `JWT_SECRET`, `COOKIE_SECRET` | `openssl rand -hex 32` |
| `S3_*` | bölüm 4.4 (media token) |
| `BACKUP_S3_*` | bölüm 4.4 (backups token) |
| `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard (E2'nin bölümü; önce test anahtarları) |
| `SMTP_*`, `MAIL_FROM` | bölüm 11 |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys (Hızlı Ekle için; boş kalırsa özellik kapalı çalışır) |
| `SENTRY_DSN_BACKEND`, `SENTRY_DSN_STOREFRONT` | bölüm 9.1 |
| `TURNSTILE_SECRET_KEY` | bölüm 4.3 |
| `COMPOSE_FILE` | yalnızca staging'de: `docker-compose.yml:docker-compose.staging.yml` |

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
| Variable | `SHOP_DOMAIN` | `technest.co.uk` veya staging alan adı |
| Variable | `NEXT_PUBLIC_IMAGE_HOSTNAME` | `media.technest.co.uk` |

Depo düzeyinde (Settings → Secrets and variables → Actions → **Variables**):
`DEPLOY_ENABLED` = `true`. **Bu değişken yoksa deploy.yml hiçbir şey yapmaz.**

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
   İş sırası: 4 imaj derlenir (`technest-backend`, `technest-storefront`,
   `technest-photo-worker`, `technest-backup`; lisans kontrolü dahil) → GHCR'ye gönderilir → sunucuda
   `docker compose pull` → `migrate` (veritabanı tabloları + ilk veriler) → `up -d` →
   sağlık kontrolü. İlk derleme 15–25 dakika sürebilir.
4. Kontrol:
   ```bash
   ssh deploy@SUNUCU_IP 'cd /opt/technest && docker compose ps'
   curl -fsS https://api.SHOP_DOMAIN/health        # "OK"
   curl -fsS https://SHOP_DOMAIN/api/health        # "ok"
   ```
   Tüm servisler `healthy` olmalı (`mailserver` yalnızca `--profile mail` ile açılır).
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
   - `COMPOSE_FILE=docker-compose.yml:docker-compose.staging.yml` ve `PHOTO_MODEL=isnet-general-use`
     (CX23'ün belleği için)
   - `STRIPE_API_KEY=` ve `STRIPE_WEBHOOK_SECRET=` → staging'in **test** değerleri (`sk_test_…`, `whsec_…`).
     Canlı anahtarla bu kopya gerçek ödemeleri alabilir veya iptal edebilir. Boş bırakmayın:
     backend üretim modunda bu ikisi olmadan açılmaz.
   - `SMTP_HOST=localhost`: bu sunucuda e-posta sunucusu yok, gönderim başarısız olur, müşterilere
     e-posta gitmez. (Boş bırakmak işe yaramaz: compose boş değeri `mail.<SHOP_DOMAIN>` yapar.)
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

Uygulama tarafında da koruma var: tamir ve toptan formları Turnstile doğrular (E1).

Test: kuralı kaydettikten sonra kendi bilgisayarınızdan
`for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.technest.co.uk/auth/customer/emailpass; done`
→ ilk istekler 401/400, sonrakiler **429** dönmeli.

---

## 11. Mail (E-posta) sunucusu (E2 bölümü)

Mağazanın tüm e-postaları (sipariş onayı, "siparişiniz hazır", iade, parola sıfırlama vb.)
`orders@technest.co.uk` adresinden, kendi sunucumuzdaki `mailserver` servisiyle gönderilir
(docker-mailserver 15: Postfix + Dovecot + OpenDKIM). Hangi olayda hangi e-postanın gittiği:
`docs/contracts/emails.md`.

| Parça | Nerede |
|---|---|
| `mailserver` servisi | `docker-compose.yml`, `profiles: [mail]` (yalnızca `--profile mail` ile başlar) |
| Backend → mailserver | İç ağ, port 587, STARTTLS zorunlu, `orders@` ile giriş. `SMTP_HOST=mail.technest.co.uk` (Docker içinde mailserver'ın takma adı) |
| Dışarı açık portlar | **25** (gelen posta: yanıtlar, geri dönen e-postalar, DMARC raporları), **993** (IMAPS: `orders@` kutusunu bir e-posta uygulamasıyla okumak için). 587 dışarı **açık değil** |
| Sertifika | Caddy alır ve yeniler; mailserver onu Caddy'nin `caddy_data` biriminden salt okunur okur |
| Hesaplar, DKIM özel anahtarı | `mail_config` biriminde (git'te **asla** yok). Parolalar yalnızca `/opt/technest/.env` içinde |

> **Önce kontrol edin: `hello@technest.co.uk` şu an nerede?** MX kaydını bu sunucuya
> çevirdiğiniz anda `@technest.co.uk` adresine gelen **tüm** e-postalar bu sunucuya gelir.
> `hello@` şu an başka bir yerdeyse (Gmail, Outlook, hosting firması), aşağıdaki 11.4'te
> `hello@` için ya bir kutu açın ya da mevcut adrese yönlendirme (alias) ekleyin. Emin
> değilseniz MX'i değiştirmeden önce E2'ye sorun.

### 11.1 Sıra (özet)

1. IP itibarını kontrol edin ve PTR'yi ayarlayın (bölüm 3, aşağıda 11.5'te tekrar).
2. Hetzner'de port 25'in açık olup olmadığını kontrol edin (11.2). Kapalıysa talep açın; beklerken relay kullanın (11.7).
3. Caddy'ye `mail.` sertifikasını aldırın (11.3).
4. Servisi başlatın, `orders@` kutusunu açın, `.env`'e parolayı yazın (11.4).
5. DKIM anahtarını üretin, DNS kayıtlarını girin (11.5).
6. Teslim testi (11.6): mail-tester.com puanı **9/10 veya üzeri**.

### 11.2 Port 25 (Hetzner)

Hetzner yeni hesaplarda **giden** port 25 ve 465'i kapalı tutar (gelen 25 açıktır). Kontrol:

```bash
ssh deploy@SUNUCU_IP 'timeout 5 bash -c "</dev/tcp/gmail-smtp-in.l.google.com/25" && echo ACIK || echo KAPALI'
```

`KAPALI` ise: ilk fatura ödendikten sonra Hetzner Console → **Support** → yeni talep
("Unblock port 25", sunucu adını ve "transactional e-mail for our own online shop, low volume,
SPF/DKIM/DMARC configured" açıklamasını yazın). Onay bir iki gün sürebilir; bu arada 11.7'deki
relay ile gönderin.

### 11.3 Sertifika (Caddy)

`mail.technest.co.uk` DNS kaydı **DNS only (gri bulut)** olmalı (bölüm 4.2). Caddy sertifikayı
alabilsin diye `Caddyfile`'da bu ad için boş bir site bloğu gerekir (dosya E4'ün; E4 ekler):

```caddyfile
mail.{$SHOP_DOMAIN} {
	respond "Tech Nest mail" 200
}
```

Kontrol (sertifika dosyası oluştu mu):

```bash
docker compose exec caddy ls /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/mail.technest.co.uk/
```

`mail.technest.co.uk.crt` ve `.key` görünmeli. Caddy sertifikayı kendisi yeniler; mailserver
dosyadaki değişikliği görüp yeniden yükler. Emin olmak için yenilemeden sonra
`docker compose restart mailserver` zararsızdır.

### 11.4 Servisi başlatma ve `orders@` kutusu

```bash
cd /opt/technest
docker compose --profile mail up -d mailserver

# orders@ kutusu (parola sorar; openssl rand -hex 24 ile üretin ve bir yere not edin)
docker compose exec mailserver setup email add orders@technest.co.uk

# Zorunlu adresler: postmaster@ ve DMARC raporları orders@'a gelsin
docker compose exec mailserver setup alias add postmaster@technest.co.uk orders@technest.co.uk
docker compose exec mailserver setup alias add dmarc@technest.co.uk orders@technest.co.uk

# hello@ bu sunucuda yaşayacaksa: ya kutu açın...
docker compose exec mailserver setup email add hello@technest.co.uk
# ...ya da mevcut adrese yönlendirin (örnek):
# docker compose exec mailserver setup alias add hello@technest.co.uk dukkan@gmail.com

docker compose exec mailserver setup email list
```

Sonra `/opt/technest/.env` içinde:

```bash
SMTP_USER=orders@technest.co.uk
SMTP_PASS=<orders@ parolası>
MAIL_FROM=Tech Nest <orders@technest.co.uk>
```

`MAIL_FROM` adresi `SMTP_USER` ile **aynı** olmalı: sunucu başka bir gönderen adını reddeder
(sahte gönderene karşı koruma). Ardından backend'i yeniden başlatın:
`docker compose up -d server worker`.

`orders@` kutusunu okumak için (isteğe bağlı): telefon/bilgisayar e-posta uygulamasında IMAP,
sunucu `mail.technest.co.uk`, port 993, SSL/TLS, kullanıcı adı tam e-posta adresi.

### 11.5 DKIM anahtarı ve DNS kayıtları

DKIM anahtarını bir kez üretin (2048 bit, seçici adı `mail`):

```bash
docker compose exec mailserver setup config dkim
docker compose exec mailserver cat /tmp/docker-mailserver/opendkim/keys/technest.co.uk/mail.txt
docker compose restart mailserver
```

`mail.txt` içindeki tırnaklı parçaları birleştirin: `v=DKIM1; h=sha256; k=rsa; p=MIIBIjAN...`
(tırnaksız, tek satır). Bu değer DKIM kaydına girer.

Cloudflare → **DNS → Records** (hepsi **DNS only**, gri bulut; TXT/MX zaten proxy'lenemez):

| Tür | Ad | Değer | Not |
|---|---|---|---|
| A | `mail` | ÜRETİM_IPv4 | Bölüm 4.2'de var |
| AAAA | `mail` | ÜRETİM_IPv6 | Sunucu IPv6 ile de gönderir |
| MX | `@` | `mail.technest.co.uk`, öncelik `10` | Gelen posta |
| TXT | `@` | `v=spf1 mx -all` | SPF. Relay kullanıyorsanız relay'in `include:` ekini ekleyin (11.7) |
| TXT | `mail._domainkey` | `v=DKIM1; h=sha256; k=rsa; p=...` | DKIM (yukarıdaki `mail.txt`) |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@technest.co.uk; adkim=s; aspf=s` | DMARC, ilk 2-4 hafta `p=none` |

**PTR / Reverse DNS (Hetzner):** Hetzner Console → sunucu → **Networking** → IPv4 adresinin
yanındaki "Edit Reverse DNS" → `mail.technest.co.uk`. IPv6 için de aynısı (adresin kendisi,
örneğin `2a01:4f8:...::1` → `mail.technest.co.uk`). PTR, A/AAAA kaydı ve sunucunun adı
(`hostname`) **aynı** olmalı; aksi halde Gmail ve Outlook e-postayı reddedebilir.

Kontrol (kendi bilgisayarınızdan):

```bash
dig +short MX technest.co.uk
dig +short TXT technest.co.uk
dig +short TXT mail._domainkey.technest.co.uk
dig +short TXT _dmarc.technest.co.uk
dig +short -x ÜRETİM_IPv4          # mail.technest.co.uk. dönmeli
```

2-4 hafta sonra DMARC raporları (`orders@` kutusuna gelir) temizse `_dmarc` kaydını
`p=quarantine` yapın.

### 11.6 Teslim testi

1. https://www.mail-tester.com adresini açın, verdiği adresi kopyalayın (`test-xxxx@srv1.mail-tester.com`).
2. Sunucudan o adrese bir deneme gönderin:
   ```bash
   docker compose exec mailserver sh -c 'printf "Subject: Tech Nest test\nFrom: Tech Nest <orders@technest.co.uk>\n\nMerhaba, bu bir test.\n" | sendmail -f orders@technest.co.uk test-xxxx@srv1.mail-tester.com'
   ```
3. Sitede "Then check your score" → **9/10 veya üzeri** olmalı. SPF, DKIM, DMARC satırları yeşil olmalı.
4. Gerçek akış: staging'de (veya canlıda küçük bir siparişle) sipariş verin → sipariş onayı
   kendi Gmail adresinize gelmeli. Gmail'de e-postayı açın → ⋮ → **Show original**:
   `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS` görmelisiniz. Spam klasörüne düşmemeli.
5. Gelen posta: kendi adresinizden `orders@technest.co.uk`'ya bir e-posta atın; IMAP ile
   (11.4) veya `docker compose logs mailserver | tail -50` ile geldiğini görün.

Sorun giderme:

```bash
docker compose logs --tail=100 mailserver          # "status=sent" iyi, "status=deferred/bounced" kötü
docker compose exec mailserver postqueue -p        # bekleyen e-postalar
docker compose exec mailserver postqueue -f        # kuyruğu şimdi yeniden dene
```

Backend loglarında yalnızca bildirim kimliği ve şablon adı görünür, alıcı adresi görünmez
(kişisel veri kuralı).

### 11.7 Port 25 kapalıysa: relay (aktarma) servisi

Hetzner port 25'i açmazsa veya IP itibarı kötüyse, mailserver e-postaları bir relay
üzerinden gönderir. DKIM imzamız korunur; müşteri yine `orders@technest.co.uk`'dan alır.
Seçenekler (hepsinde AB/UK sunucusu seçin): **Brevo** (ücretsiz, günde 300 e-posta),
**Mailgun EU**, **Amazon SES (eu-west-2, Londra)**.

1. Relay'de hesap açın, `technest.co.uk` alan adını doğrulayın (size vereceği DNS kayıtlarını
   Cloudflare'e girin) ve bir **SMTP anahtarı** oluşturun.
2. `/opt/technest/.env`:
   ```bash
   MAIL_RELAY_HOST=[smtp-relay.brevo.com]:587    # köşeli parantez önemli (MX araması yapılmaz)
   MAIL_RELAY_USER=<relay SMTP kullanıcı adı>
   MAIL_RELAY_PASSWORD=<relay SMTP anahtarı>
   ```
3. SPF kaydına relay'in ekini ekleyin, örneğin Brevo: `v=spf1 mx include:spf.brevo.com -all`
   (Mailgun: `include:mailgun.org`, SES: `include:amazonses.com`).
4. `docker compose --profile mail up -d mailserver` → 11.6'daki testi tekrarlayın.

Port 25 açıldığında relay'i bırakmak için üç `MAIL_RELAY_*` değerini boşaltın, SPF'den
`include:` ekini çıkarın ve servisi yeniden başlatın.

### 11.8 Yedek

Hesaplar ve DKIM anahtarı `mail_config` biriminde; gece yedeği (bölüm 8) yalnızca
veritabanını alır. Kurulumdan sonra ve her hesap değişikliğinden sonra bir kopya alın:

```bash
docker run --rm -v technest_mail_config:/src:ro -v /opt/technest:/out alpine \
  tar czf /out/mail-config-$(date +%F).tar.gz -C /src .
chmod 600 /opt/technest/mail-config-*.tar.gz
```

Bu dosyayı parola yöneticinize veya şifreli bir yere taşıyın (içinde DKIM özel anahtarı var).
Kaybolursa: yeni DKIM anahtarı üretip DNS'teki `mail._domainkey` kaydını güncellemek ve
kutuları yeniden açmak yeterlidir; siparişler etkilenmez.

---

## 12. Canlıya geçiş (cutover) kontrol listesi (hafta 8)

Lead ve E4 birlikte yapar.

**Bir gün önce**
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
  - [ ] Gerçek kartla küçük bir sipariş (teslimat) → onay e-postası → iade
  - [ ] Gerçek kartla Click & Collect siparişi → admin panosunda "Hazır" → "Teslim alındı" → ödeme alındı
  - [ ] Admin: telefondan Hızlı Ekle ile bir ürün (< 60 sn)
  - [ ] Toptan başvuru → onay e-postası; tamir randevusu → dükkana e-posta
- [ ] `docker compose ps`: hepsi healthy; `backup` gece çalıştı mı (ertesi sabah)
- [ ] İlk hafta: her gün Sentry ve UptimeRobot kontrolü
