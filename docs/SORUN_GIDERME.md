# Sorun Giderme Rehberi

Bu rehber, NeoList kurulumu ve kullanımı sırasında karşılaşabileceğiniz yaygın sorunları ve çözümlerini içerir.

---

## 📋 İçindekiler

1. [Kurulum Sorunları](#kurulum-sorunları)
2. [Veritabanı Sorunları](#veritabanı-sorunları)
3. [Uygulama Sorunları](#uygulama-sorunları)
4. [Telegram Bot Sorunları](#telegram-bot-sorunları)
5. [Zimbra Entegrasyon Sorunları](#zimbra-entegrasyon-sorunları)
6. [Performans Sorunları](#performans-sorunları)

---

## Kurulum Sorunları

### 1. "npm install" başarısız oluyor

**Hata:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE could not resolve
```

**Çözüm:**
```bash
# Önbelleği temizle
npm cache clean --force

# node_modules'u sil ve tekrar dene
rm -rf node_modules package-lock.json
npm install

# Hala sorun varsa legacy peer deps ile dene
npm install --legacy-peer-deps
```

### 2. "oracledb" paketi yüklenemiyor

**Hata:**
```
Error: Cannot find module 'oracledb'
DPI-1047: Cannot locate a 64-bit Oracle Client library
```

**Çözüm:**

1. Oracle Instant Client'ın kurulu olduğundan emin olun
2. PATH'e eklendiğini kontrol edin:

```bash
# Windows
echo %PATH% | findstr oracle

# Linux/macOS
echo $LD_LIBRARY_PATH
```

3. Doğru versiyonu kullanın (64-bit Node.js → 64-bit Oracle Client)

### 3. Node.js versiyon uyumsuzluğu

**Hata:**
```
error engine node ^18.0.0 || ^20.0.0
```

**Çözüm:**
```bash
# Mevcut versiyonu kontrol et
node --version

# nvm ile doğru versiyonu yükle
nvm install 20
nvm use 20
```

---

## Veritabanı Sorunları

### 1. Oracle'a bağlanamıyor

**Hata:**
```
ORA-12541: TNS:no listener
ORA-12514: TNS:listener does not currently know of service
```

**Çözüm:**

1. Connection string'i kontrol edin:
```bash
# Doğru format
ORACLE_CONNECTION_STRING=hostname:1521/SERVICE_NAME
```

2. Sunucuya erişimi test edin:
```bash
# Port kontrolü
telnet oracle-server 1521

# tnsping ile test
tnsping ORCL
```

3. Firewall kurallarını kontrol edin

### 2. Migrasyon hatası

**Hata:**
```
ORA-00942: table or view does not exist
```

**Çözüm:**
```bash
# Migrasyonları sıfırdan çalıştır
npm run db:migrate

# Belirli bir migrasyonu manuel çalıştır
npx tsx scripts/db/migrate.ts
```

### 3. Kullanıcı yetki hatası

**Hata:**
```
ORA-01031: insufficient privileges
```

**Çözüm:**
```sql
-- DBA olarak bağlanın ve yetkileri verin
GRANT CONNECT, RESOURCE TO neolist_user;
GRANT UNLIMITED TABLESPACE TO neolist_user;
GRANT CREATE SESSION TO neolist_user;
```

---

## Uygulama Sorunları

### 1. "npm run dev" çalışmıyor

**Hata:**
```
Error: Cannot find module 'next'
```

**Çözüm:**
```bash
# Bağımlılıkları yeniden yükle
rm -rf node_modules .next
npm install
npm run dev
```

### 2. Ortam değişkenleri okunmuyor

**Hata:**
```
Error: ORACLE_USER is not defined
```

**Çözüm:**

1. `.env.local` dosyasının mevcut olduğunu kontrol edin
2. Dosya adının doğru olduğundan emin olun (`.env` değil `.env.local`)
3. Terminal'i yeniden başlatın

```bash
# Ortam değişkenini kontrol et
echo $ORACLE_USER
```

### 3. Build hatası

**Hata:**
```
Type error: Property 'xxx' does not exist
```

**Çözüm:**
```bash
# TypeScript hatalarını kontrol et
npx tsc --noEmit

# Temiz build
rm -rf .next
npm run build
```

### 4. Sayfa 404 hatası veriyor

**Çözüm:**

1. URL'in doğru olduğundan emin olun
2. Dosya adını kontrol edin (büyük/küçük harf duyarlı)
3. `next.config.ts` ayarlarını kontrol edin

---

## Telegram Bot Sorunları

### 1. Bot mesajlara yanıt vermiyor

**Kontrol Listesi:**

- [ ] `TELEGRAM_BOT_TOKEN` doğru mu?
- [ ] Webhook URL'i ayarlandı mı?
- [ ] Sunucu dışarıdan erişilebilir mi?

**Çözüm:**
```bash
# Webhook durumunu kontrol et
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Webhook'u yeniden ayarla
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-domain/api/telegram/webhook"
```

### 2. Webhook SSL hatası

**Hata:**
```
SSL certificate problem: self signed certificate
```

**Çözüm:**

1. Geçerli SSL sertifikası kullanın (Let's Encrypt önerilir)
2. Geliştirme için ngrok kullanın:
```bash
ngrok http 3000
```

### 3. "Hesap bağlı değil" hatası

**Çözüm:**

1. Kullanıcının NeoList'e giriş yapması gerekir
2. Ayarlar > Telegram menüsünden bağlantı yapılmalı
3. Veritabanında `telegram_chat_id` alanını kontrol edin

---

## Zimbra Entegrasyon Sorunları

### 1. CalDAV 404 hatası

**Bu normal bir durumdur!** Kullanıcı Tasks klasörünü paylaşmamışsa 404 döner ve sistem otomatik olarak Admin SOAP API'ye geçer.

### 2. Admin SOAP API 401 hatası

**Çözüm:**

1. Admin credentials'ı kontrol edin:
```bash
echo $ZIMBRA_ADMIN_EMAIL
echo $ZIMBRA_ADMIN_PASSWORD
```

2. Zimbra'da admin yetkilerini kontrol edin:
```bash
zmprov ga admin@domain.com | grep zimbraIs
```

### 3. Bağlantı zaman aşımı

**Çözüm:**

1. Port erişimini kontrol edin:
```bash
nc -zv zimbra-server 443
nc -zv zimbra-server 7071
```

2. Firewall kurallarını kontrol edin
3. Zimbra sunucusunun çalıştığından emin olun

---

## Performans Sorunları

### 1. Sayfa yavaş yükleniyor

**Çözüm:**

1. Production build kullanın:
```bash
npm run build
npm start
```

2. Veritabanı indexlerini kontrol edin:
```sql
SELECT index_name, table_name FROM user_indexes;
```

3. Query performansını analiz edin:
```sql
EXPLAIN PLAN FOR SELECT * FROM tasks WHERE user_id = 'xxx';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```

### 2. Yüksek bellek kullanımı

**Çözüm:**

1. Node.js bellek limitini artırın:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

2. PM2 ile cluster mode kullanın:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    instances: 'max',
    exec_mode: 'cluster'
  }]
}
```

### 3. Veritabanı bağlantı havuzu doldu

**Hata:**
```
ORA-12516: TNS:listener could not find available handler
```

**Çözüm:**

1. Connection pool ayarlarını optimize edin:
```typescript
// src/lib/oracle.ts
const pool = await oracledb.createPool({
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 1
})
```

2. Bağlantıları düzgün kapatın

---

## Log Kontrolü

### Uygulama Logları

```bash
# PM2 logları
pm2 logs neolist

# Gerçek zamanlı
pm2 logs neolist --lines 100 -f

# Sadece hatalar
pm2 logs neolist --err
```

### Veritabanı Logları

```sql
-- Son hatalar
SELECT * FROM user_errors ORDER BY sequence DESC;

-- Aktif oturumlar
SELECT * FROM v$session WHERE username = 'NEOLIST_USER';
```

---

## Yardım Alma

Sorununuz çözülmediyse:

1. **Log dosyalarını** toplayın
2. **Hata mesajını** tam olarak kopyalayın
3. **Sistem bilgilerini** not edin:
   - Node.js versiyonu
   - npm versiyonu
   - İşletim sistemi
   - Oracle versiyonu
4. Sistem yöneticinize başvurun

---

## Sık Sorulan Sorular

### S: Uygulamayı farklı bir portta çalıştırabilir miyim?

**C:** Evet, `.env.local` dosyasında `PORT` değişkenini değiştirin:
```env
PORT=8080
```

### S: Birden fazla instance çalıştırabilir miyim?

**C:** Evet, PM2 cluster mode ile:
```bash
pm2 start ecosystem.config.js -i max
```

### S: Veritabanını yedekleyebilir miyim?

**C:** Oracle Data Pump kullanın:
```bash
expdp neolist_user/password@ORCL schemas=NEOLIST_USER directory=BACKUP dumpfile=neolist.dmp
```

### S: Test ortamını nasıl kurarım?

**C:** Ayrı bir `.env.test` dosyası oluşturun ve test veritabanı kullanın:
```bash
NODE_ENV=test npm test
```
