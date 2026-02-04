# NeoList Detaylı Kurulum Rehberi

Bu rehber, NeoList'i sıfırdan kurmanız için gereken tüm adımları içerir.

---

## 📋 İçindekiler

1. [Ön Gereksinimler](#1-ön-gereksinimler)
2. [Oracle Instant Client Kurulumu](#2-oracle-instant-client-kurulumu)
3. [Proje Kurulumu](#3-proje-kurulumu)
4. [Ortam Değişkenleri](#4-ortam-değişkenleri)
5. [Veritabanı Kurulumu](#5-veritabanı-kurulumu)
6. [Uygulamayı Başlatma](#6-uygulamayı-başlatma)
7. [Prodüksiyon Dağıtımı](#7-prodüksiyon-dağıtımı)
8. [Doğrulama ve Test](#8-doğrulama-ve-test)

---

## 1. Ön Gereksinimler

### Yazılım Gereksinimleri

| Yazılım | Minimum | Önerilen | Kontrol Komutu |
|---------|---------|----------|----------------|
| Node.js | 18.x | 20.x LTS | `node --version` |
| npm | 9.x | 10.x | `npm --version` |
| Git | 2.x | 2.40+ | `git --version` |
| Oracle Database | 19c | 21c | - |

### Donanım Gereksinimleri (Sunucu)

| Kaynak | Minimum | Önerilen |
|--------|---------|----------|
| CPU | 2 Core | 4 Core |
| RAM | 4 GB | 8 GB |
| Disk | 20 GB | 50 GB SSD |

---

## 2. Oracle Instant Client Kurulumu

Oracle veritabanına bağlanmak için Oracle Instant Client gereklidir.

### Windows

```powershell
# 1. Oracle Instant Client'ı indirin
# https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html
# Basic veya Basic Light paketini indirin

# 2. Bir klasöre çıkarın (örn: C:\oracle\instantclient_19_20)

# 3. Sistem PATH'ine ekleyin
# Sistem Özellikleri > Gelişmiş > Ortam Değişkenleri > Path > Düzenle
# C:\oracle\instantclient_19_20 ekleyin

# 4. Doğrulayın (yeni terminal açın)
where oci.dll
```

### Linux (Ubuntu/Debian)

```bash
# 1. Gerekli sistem paketlerini yükleyin
sudo apt-get update
sudo apt-get install -y libaio1 unzip wget

# 2. Oracle Instant Client'ı indirin
cd /tmp
wget https://download.oracle.com/otn_software/linux/instantclient/2110000/instantclient-basiclite-linux.x64-21.10.0.0.0dbru.zip

# 3. Çıkarın ve konfigüre edin
sudo mkdir -p /opt/oracle
sudo unzip instantclient-basiclite-linux.x64-21.10.0.0.0dbru.zip -d /opt/oracle

# 4. Kütüphane yolunu ayarlayın
echo '/opt/oracle/instantclient_21_10' | sudo tee /etc/ld.so.conf.d/oracle-instantclient.conf
sudo ldconfig

# 5. Ortam değişkenini ayarlayın (~/.bashrc veya ~/.profile)
echo 'export LD_LIBRARY_PATH=/opt/oracle/instantclient_21_10:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc
```

### Linux (CentOS/RHEL)

```bash
# 1. Gerekli paketleri yükleyin
sudo yum install -y libaio unzip wget

# 2-5. Ubuntu adımlarının aynısı
```

### macOS

```bash
# Homebrew ile
brew tap InstantClientTap/instantclient
brew install instantclient-basiclite

# Ortam değişkeni (zsh için)
echo 'export DYLD_LIBRARY_PATH=/usr/local/lib:$DYLD_LIBRARY_PATH' >> ~/.zshrc
source ~/.zshrc
```

---

## 3. Proje Kurulumu

### 3.1. Projeyi İndirin

```bash
# Git ile klonlayın
git clone https://github.com/your-org/neolist.git
cd neolist

# VEYA zip olarak indirin ve çıkarın
```

### 3.2. Otomatik Kurulum (Önerilen)

```bash
# Tüm adımları otomatik yapar
npm run setup
```

### 3.3. Manuel Kurulum

```bash
# 1. Bağımlılıkları yükleyin
npm install

# 2. Ortam değişkenlerini kopyalayın
cp .env.example .env.local

# 3. .env.local dosyasını düzenleyin (bir sonraki bölüme bakın)
```

---

## 4. Ortam Değişkenleri

`.env.local` dosyasını düzenleyin:

### Zorunlu Ayarlar

```env
# Oracle Veritabanı
ORACLE_USER=NEOLIST_USER
ORACLE_PASSWORD=güçlü_şifre_123
ORACLE_CONNECTION_STRING=oracle-sunucu.domain.com:1521/ORCL

# Güvenlik (rastgele, min 32 karakter)
AUTH_SECRET=bu-çok-güvenli-bir-anahtar-olmalı-en-az-32-karakter

# Uygulama URL'si
NEXTAUTH_URL=http://localhost:3000
```

### Opsiyonel Ayarlar

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_URL=https://sizin-domain.com/api/telegram/webhook

# Zimbra Entegrasyonu
ZIMBRA_HOST=webmail.domain.com
ZIMBRA_ADMIN_EMAIL=admin@domain.com
ZIMBRA_ADMIN_PASSWORD=zimbra_şifresi
```

### Güvenlik Anahtarı Oluşturma

```bash
# Linux/macOS
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 5. Veritabanı Kurulumu

### 5.1. Oracle Kullanıcısı Oluşturma

Oracle veritabanında bir kullanıcı oluşturun:

```sql
-- SYS veya DBA olarak bağlanın
CREATE USER neolist_user IDENTIFIED BY "güçlü_şifre_123"
    DEFAULT TABLESPACE users
    TEMPORARY TABLESPACE temp
    QUOTA UNLIMITED ON users;

GRANT CONNECT, RESOURCE TO neolist_user;
GRANT CREATE SESSION TO neolist_user;
GRANT CREATE TABLE TO neolist_user;
GRANT CREATE SEQUENCE TO neolist_user;
GRANT CREATE VIEW TO neolist_user;
GRANT CREATE PROCEDURE TO neolist_user;
```

### 5.2. Migrasyonları Çalıştırma

```bash
# Veritabanı şemasını oluştur
npm run db:migrate
```

### 5.3. İlk Admin Kullanıcısı

```bash
# Superadmin kullanıcısı oluştur
npx tsx scripts/db/create-admin.ts
```

---

## 6. Uygulamayı Başlatma

### Geliştirme Modu

```bash
npm run dev

# Uygulama http://localhost:3000 adresinde çalışır
# Değişiklikler otomatik yüklenir (hot-reload)
```

### Prodüksiyon Modu

```bash
# 1. Derle
npm run build

# 2. Başlat
npm start
```

---

## 7. Prodüksiyon Dağıtımı

### PM2 ile (Önerilen)

```bash
# 1. PM2'yi global olarak yükleyin
npm install -g pm2

# 2. Uygulamayı başlatın
pm2 start ecosystem.config.js

# 3. Otomatik başlatma için
pm2 startup
pm2 save

# Yönetim komutları
pm2 status          # Durum
pm2 logs neolist    # Loglar
pm2 restart neolist # Yeniden başlat
pm2 stop neolist    # Durdur
```

### Systemd ile (Linux)

```bash
# 1. Service dosyası oluşturun
sudo nano /etc/systemd/system/neolist.service
```

```ini
[Unit]
Description=NeoList Task Manager
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/neolist
ExecStart=/usr/bin/node /var/www/neolist/.next/standalone/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=neolist
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
# 2. Aktifleştirin ve başlatın
sudo systemctl daemon-reload
sudo systemctl enable neolist
sudo systemctl start neolist

# 3. Durum kontrolü
sudo systemctl status neolist
```

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/neolist
server {
    listen 80;
    server_name neolist.domain.com;
    
    # HTTP'den HTTPS'e yönlendir
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name neolist.domain.com;
    
    ssl_certificate /etc/letsencrypt/live/neolist.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/neolist.domain.com/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 8. Doğrulama ve Test

### Kurulum Doğrulama

```bash
# 1. Veritabanı bağlantısını test et
npm run test:db

# 2. API'yi test et
curl http://localhost:3000/api/health

# 3. Tüm testleri çalıştır
npm test
```

### Sağlık Kontrolü Endpoint'leri

| Endpoint | Açıklama |
|----------|----------|
| `/api/health` | Genel sağlık durumu |
| `/api/health/db` | Veritabanı bağlantısı |

### Log Dosyaları

```bash
# PM2 logları
pm2 logs neolist

# Uygulama logları
tail -f logs/app.log

# Hata logları
tail -f logs/error.log
```

---

## ❓ Sorun Giderme

Kurulum sırasında sorun yaşarsanız:

1. **[docs/SORUN_GIDERME.md](SORUN_GIDERME.md)** dosyasına bakın
2. Log dosyalarını kontrol edin
3. Node.js ve npm versiyonlarını kontrol edin
4. Oracle Instant Client kurulumunu doğrulayın

---

## 📚 Sonraki Adımlar

- [Telegram Bot Kurulumu](TELEGRAM.md)
- [Zimbra Entegrasyonu](ZIMBRA.md)
- [API Referansı](API.md)
