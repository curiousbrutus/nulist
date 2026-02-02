# Prodüksiyon Dağıtımı

Bu rehber, NeoList'i prodüksiyon ortamına dağıtmak için gerekli adımları içerir.

---

## 📋 İçindekiler

1. [Ön Hazırlık](#ön-hazırlık)
2. [Sunucu Kurulumu](#sunucu-kurulumu)
3. [PM2 ile Dağıtım](#pm2-ile-dağıtım)
4. [Nginx Yapılandırması](#nginx-yapılandırması)
5. [SSL Sertifikası](#ssl-sertifikası)
6. [İzleme ve Logging](#i̇zleme-ve-logging)
7. [Yedekleme](#yedekleme)
8. [Güncelleme Prosedürü](#güncelleme-prosedürü)

---

## Ön Hazırlık

### Sunucu Gereksinimleri

| Kaynak | Minimum | Önerilen |
|--------|---------|----------|
| CPU | 2 Core | 4 Core |
| RAM | 4 GB | 8 GB |
| Disk | 20 GB SSD | 50 GB SSD |
| OS | Ubuntu 20.04+ | Ubuntu 22.04 LTS |

### Gerekli Yazılımlar

- Node.js 18+ (LTS önerilir)
- npm 9+
- Nginx
- PM2
- Oracle Instant Client
- Git

---

## Sunucu Kurulumu

### 1. Sistem Güncellemesi

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Node.js Kurulumu

```bash
# NodeSource repository ekle
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js yükle
sudo apt install -y nodejs

# Doğrula
node --version
npm --version
```

### 3. PM2 Kurulumu

```bash
sudo npm install -g pm2
```

### 4. Nginx Kurulumu

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 5. Proje Klasörü Oluşturma

```bash
# Web uygulamaları için klasör
sudo mkdir -p /var/www/neolist
sudo chown $USER:$USER /var/www/neolist

# Log klasörü
sudo mkdir -p /var/log/neolist
sudo chown $USER:$USER /var/log/neolist
```

---

## PM2 ile Dağıtım

### 1. Projeyi Klonlama

```bash
cd /var/www/neolist
git clone https://github.com/your-org/neolist.git .
```

### 2. Bağımlılıkları Yükleme

```bash
npm ci --production
```

### 3. Ortam Değişkenleri

```bash
# .env.local oluştur
cp .env.example .env.local
nano .env.local
```

Prodüksiyon için gerekli ayarlar:

```env
NODE_ENV=production
PORT=3000

# Veritabanı
ORACLE_USER=neolist_prod
ORACLE_PASSWORD=güçlü_şifre
ORACLE_CONNECTION_STRING=oracle.domain.com:1521/PRODDB

# Güvenlik (rastgele, uzun bir değer)
AUTH_SECRET=çok-uzun-rastgele-güvenli-anahtar-32-karakter-üstü

# Uygulama URL'si
NEXTAUTH_URL=https://neolist.domain.com
```

### 4. Projeyi Derleme

```bash
npm run build
```

### 5. PM2 ile Başlatma

```bash
pm2 start ecosystem.config.js
```

### 6. Sistem Başlangıcında Otomatik Başlatma

```bash
pm2 startup
pm2 save
```

### ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'neolist',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/neolist',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/neolist/error.log',
    out_file: '/var/log/neolist/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
```

---

## Nginx Yapılandırması

### 1. Site Yapılandırması

```bash
sudo nano /etc/nginx/sites-available/neolist
```

```nginx
# Upstream tanımı
upstream neolist_upstream {
    server 127.0.0.1:3000;
    keepalive 64;
}

# HTTP -> HTTPS yönlendirme
server {
    listen 80;
    listen [::]:80;
    server_name neolist.domain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name neolist.domain.com;

    # SSL sertifikaları
    ssl_certificate /etc/letsencrypt/live/neolist.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/neolist.domain.com/privkey.pem;
    
    # SSL ayarları
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Gzip sıkıştırma
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Statik dosyalar
    location /_next/static {
        alias /var/www/neolist/.next/static;
        expires 365d;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    location /public {
        alias /var/www/neolist/public;
        expires 30d;
        access_log off;
    }

    # Uygulama
    location / {
        proxy_pass http://neolist_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
```

### 2. Site'ı Aktifleştirme

```bash
sudo ln -s /etc/nginx/sites-available/neolist /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## SSL Sertifikası

### Let's Encrypt ile Ücretsiz SSL

```bash
# Certbot yükle
sudo apt install -y certbot python3-certbot-nginx

# Sertifika al
sudo certbot --nginx -d neolist.domain.com

# Otomatik yenileme testi
sudo certbot renew --dry-run
```

---

## İzleme ve Logging

### PM2 İzleme

```bash
# Durum kontrolü
pm2 status

# Canlı loglar
pm2 logs neolist

# Kaynak kullanımı
pm2 monit
```

### Log Rotasyonu

```bash
# PM2 log rotasyonu yükle
pm2 install pm2-logrotate

# Ayarlar
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### Sistem Log Rotasyonu

```bash
sudo nano /etc/logrotate.d/neolist
```

```
/var/log/neolist/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## Yedekleme

### Veritabanı Yedekleme

```bash
# Günlük yedekleme scripti
cat > /var/www/neolist/scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/neolist"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Oracle Data Pump ile yedek
expdp neolist_prod/password@PRODDB \
    schemas=NEOLIST_PROD \
    directory=BACKUP \
    dumpfile=neolist_$DATE.dmp \
    logfile=backup_$DATE.log

# Eski yedekleri sil (7 günden eski)
find $BACKUP_DIR -name "*.dmp" -mtime +7 -delete

echo "Yedekleme tamamlandı: $DATE"
EOF

chmod +x /var/www/neolist/scripts/backup.sh
```

### Cron ile Otomatik Yedekleme

```bash
# Her gece 02:00'de yedekle
crontab -e
# Ekle:
0 2 * * * /var/www/neolist/scripts/backup.sh >> /var/log/neolist/backup.log 2>&1
```

---

## Güncelleme Prosedürü

### Sıfır Kesinti Güncellemesi

```bash
#!/bin/bash
# update.sh

cd /var/www/neolist

# 1. Son değişiklikleri al
git fetch origin
git pull origin main

# 2. Bağımlılıkları güncelle
npm ci --production

# 3. Projeyi derle
npm run build

# 4. PM2 ile yeniden başlat (zero-downtime)
pm2 reload ecosystem.config.js

echo "Güncelleme tamamlandı!"
```

### Rollback Prosedürü

```bash
# Önceki versiyona dön
git checkout HEAD~1
npm ci --production
npm run build
pm2 reload ecosystem.config.js
```

---

## Güvenlik Kontrol Listesi

- [ ] Firewall aktif (sadece 80, 443, 22 açık)
- [ ] SSH key-based authentication
- [ ] fail2ban kurulu
- [ ] Düzenli güvenlik güncellemeleri
- [ ] HTTPS zorunlu
- [ ] Güçlü şifreler
- [ ] Ortam değişkenleri .env.local'da (git'te değil)
- [ ] Rate limiting aktif
- [ ] CORS doğru yapılandırılmış

### Firewall Ayarları

```bash
sudo ufw enable
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw status
```

---

## Sağlık Kontrolü

### Health Check Endpoint

```bash
# Canlılık kontrolü
curl -f https://neolist.domain.com/api/health

# Veritabanı kontrolü
curl -f https://neolist.domain.com/api/health/db
```

### Monitoring Script

```bash
#!/bin/bash
# health-check.sh

URL="https://neolist.domain.com/api/health"

if ! curl -sf "$URL" > /dev/null; then
    echo "ALARM: NeoList yanıt vermiyor!"
    # E-posta gönder, Slack bildirim, vs.
    pm2 restart neolist
fi
```

---

## Performans Optimizasyonu

### Node.js Ayarları

```bash
# PM2 cluster mode (CPU sayısı kadar instance)
pm2 start ecosystem.config.js -i max

# Bellek limiti
NODE_OPTIONS="--max-old-space-size=4096" pm2 start ...
```

### Nginx Cache

```nginx
# Statik dosyalar için cache
location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff2)$ {
    expires 30d;
    add_header Cache-Control "public, no-transform";
}
```

---

## İlgili Dosyalar

- [ecosystem.config.js](../ecosystem.config.js) - PM2 yapılandırması
- [docs/KURULUM.md](KURULUM.md) - Detaylı kurulum rehberi
- [docs/SORUN_GIDERME.md](SORUN_GIDERME.md) - Sorun giderme
