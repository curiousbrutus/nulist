# Telegram Bot Kurulumu

Bu rehber, NeoList'in Telegram bot entegrasyonunu kurmanızı sağlar.

---

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Bot Oluşturma](#bot-oluşturma)
3. [Webhook Yapılandırması](#webhook-yapılandırması)
4. [Kullanıcı Bağlama](#kullanıcı-bağlama)
5. [Bot Komutları](#bot-komutları)
6. [Sorun Giderme](#sorun-giderme)

---

## Genel Bakış

NeoList Telegram botu şunları yapabilir:

- ✅ Telegram üzerinden yeni görev oluşturma
- ✅ Görevleri listeleme ve yönetme
- ✅ Görev hatırlatmaları alma
- ✅ Doğal dil ile görev tanımlama

### Mimari

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Telegram   │────▶│   NeoList   │────▶│   Oracle    │
│   Sunucu    │     │   Webhook   │     │   Database  │
│             │◀────│   API       │◀────│             │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## Bot Oluşturma

### 1. BotFather ile Bot Oluşturma

1. Telegram'da [@BotFather](https://t.me/BotFather) ile konuşun
2. `/newbot` komutunu gönderin
3. Bot için bir isim girin (örn: "NeoList Görev Botu")
4. Bot için bir kullanıcı adı girin (örn: "neolist_gorev_bot")
5. BotFather size bir **API Token** verecek

```
Done! Congratulations on your new bot. You will find it at t.me/neolist_gorev_bot.
Use this token to access the HTTP API:
123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 2. Bot Komutlarını Ayarlama

BotFather'a şu komutu gönderin:

```
/setcommands
```

Sonra bot'u seçip bu komut listesini yapıştırın:

```
start - Botu başlat ve hesabını bağla
gorev - Yeni görev oluştur
liste - Görevlerini listele
bugun - Bugünkü görevleri göster
tamamla - Görevi tamamlandı olarak işaretle
sil - Görevi sil
ayarlar - Bot ayarları
yardim - Yardım mesajı
```

### 3. Ortam Değişkenlerini Ayarlama

`.env.local` dosyasına ekleyin:

```env
# Telegram Bot Token (BotFather'dan aldığınız)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Webhook URL (sunucunuzun dışarıdan erişilebilir adresi)
TELEGRAM_WEBHOOK_URL=https://neolist.domain.com/api/telegram/webhook
```

---

## Webhook Yapılandırması

### Geliştirme Ortamı (ngrok ile)

Localhost'u dışarıya açmak için ngrok kullanın:

```bash
# 1. ngrok'u yükleyin
# https://ngrok.com/download

# 2. ngrok'u başlatın
ngrok http 3000

# 3. ngrok URL'ini kopyalayın
# Örn: https://abc123.ngrok.io

# 4. .env.local'ı güncelleyin
TELEGRAM_WEBHOOK_URL=https://abc123.ngrok.io/api/telegram/webhook

# 5. Webhook'u kaydedin
npm run telegram:setup-webhook
```

### Prodüksiyon Ortamı

```bash
# 1. SSL sertifikası olduğundan emin olun (HTTPS zorunlu)
# Let's Encrypt kullanabilirsiniz

# 2. .env.local'ı güncelleyin
TELEGRAM_WEBHOOK_URL=https://neolist.domain.com/api/telegram/webhook

# 3. Webhook'u kaydedin
npm run telegram:setup-webhook
```

### Webhook Doğrulama

```bash
# Webhook durumunu kontrol edin
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Başarılı yanıt:
```json
{
  "ok": true,
  "result": {
    "url": "https://neolist.domain.com/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## Kullanıcı Bağlama

### Otomatik Bağlama (Önerilen)

1. Kullanıcı NeoList'e giriş yapar
2. **Ayarlar > Telegram Bağlantısı** menüsüne gider
3. **"Telegram'ı Bağla"** butonuna tıklar
4. Bot'a yönlendirilir ve `/start` komutu otomatik gönderilir
5. Hesaplar bağlanır

### Manuel Bağlama

1. Kullanıcı Telegram'da bota mesaj atar: `/start`
2. Bot bir **bağlantı kodu** verir
3. Kullanıcı NeoList'te Ayarlar'a gidip bu kodu girer
4. Hesaplar bağlanır

---

## Bot Komutları

### Temel Komutlar

| Komut | Açıklama | Örnek |
|-------|----------|-------|
| `/start` | Botu başlat | `/start` |
| `/yardim` | Yardım mesajı | `/yardim` |

### Görev Komutları

| Komut | Açıklama | Örnek |
|-------|----------|-------|
| `/gorev` | Yeni görev oluştur | `/gorev Raporu hazırla` |
| `/liste` | Tüm görevleri listele | `/liste` |
| `/bugun` | Bugünkü görevler | `/bugun` |
| `/tamamla` | Görevi tamamla | `/tamamla 5` |
| `/sil` | Görevi sil | `/sil 3` |

### Doğal Dil Desteği

Bot doğal dilde yazılan görevleri anlayabilir:

```
"Yarın saat 3'te toplantı"
→ Görev: "Toplantı"
→ Tarih: Yarın 15:00

"Cuma günü raporu bitir, önemli"
→ Görev: "Raporu bitir"
→ Tarih: Cuma
→ Öncelik: Yüksek
```

---

## Gelişmiş Özellikler

### Hatırlatmalar

Kullanıcılar görevler için hatırlatma alabilir:

```
/hatirlat 5 30dk
→ 5 numaralı görev için 30 dakika sonra hatırlatma

/hatirlat 3 yarin09:00
→ 3 numaralı görev için yarın 09:00'da hatırlatma
```

### Inline Mode

Herhangi bir sohbette `@neolist_bot` yazarak görev arayabilirsiniz:

```
@neolist_bot toplantı
→ "toplantı" içeren görevleri listeler
```

### Grup Desteği

Bot gruplarına eklenebilir:

1. Botu gruba ekleyin
2. `/bagla` komutuyla grubu bir NeoList klasörüne bağlayın
3. Artık gruptaki herkes o klasöre görev ekleyebilir

---

## API Endpoint'leri

### Webhook Endpoint

```
POST /api/telegram/webhook
```

Telegram bu endpoint'e mesajları gönderir.

### Bağlantı Endpoint'leri

```
POST /api/telegram/link
→ Kullanıcıyı Telegram hesabına bağla

DELETE /api/telegram/unlink
→ Bağlantıyı kaldır

GET /api/telegram/status
→ Bağlantı durumunu kontrol et
```

---

## Sorun Giderme

### 1. "Webhook hatası" mesajı

**Olası Nedenler:**
- URL yanlış
- SSL sertifikası geçersiz
- Sunucu dışarıdan erişilebilir değil

**Çözüm:**
```bash
# Webhook'u kontrol edin
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Webhook'u yeniden ayarlayın
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/api/telegram/webhook"
```

### 2. Bot mesajlara yanıt vermiyor

**Olası Nedenler:**
- Webhook kayıtlı değil
- Sunucu çalışmıyor
- Token yanlış

**Çözüm:**
```bash
# Uygulama loglarını kontrol edin
pm2 logs neolist

# Webhook'un çalışıp çalışmadığını test edin
curl -X POST https://your-domain.com/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"message":{"text":"/test"}}'
```

### 3. "Hesap bağlı değil" hatası

**Çözüm:**
1. Kullanıcının NeoList hesabına giriş yapmasını sağlayın
2. Ayarlar > Telegram menüsünden bağlantı işlemini tekrarlayın

### 4. Geliştirme ortamında webhook çalışmıyor

**Çözüm:**
ngrok veya benzeri bir tünel servisi kullanın:

```bash
# ngrok ile
ngrok http 3000

# localtunnel ile
npx localtunnel --port 3000
```

---

## Güvenlik

### Webhook Doğrulama

Gelen isteklerin gerçekten Telegram'dan geldiğini doğrulamak için:

```typescript
// src/app/api/telegram/webhook/route.ts
import crypto from 'crypto'

function verifyTelegramWebhook(body: string, secretToken: string): boolean {
    const hash = crypto
        .createHmac('sha256', secretToken)
        .update(body)
        .digest('hex')
    
    return hash === request.headers.get('X-Telegram-Bot-Api-Secret-Token')
}
```

### Rate Limiting

Bot spam koruması için rate limiting uygulanır:
- Kullanıcı başına dakikada max 20 mesaj
- IP başına dakikada max 100 istek

---

## İlgili Dosyalar

- [src/lib/telegram-bot.ts](../src/lib/telegram-bot.ts) - Bot ana modülü
- [src/app/api/telegram/webhook/route.ts](../src/app/api/telegram/webhook/route.ts) - Webhook handler
- [setup-telegram-webhook.js](../setup-telegram-webhook.js) - Webhook kurulum scripti
