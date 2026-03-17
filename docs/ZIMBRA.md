# Zimbra Entegrasyonu

Bu rehber, NeoList'in Zimbra mail sunucusuyla entegrasyonunu açıklar.

---

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Nasıl Çalışır?](#nasıl-çalışır)
3. [Yapılandırma](#yapılandırma)
4. [Özellikler](#özellikler)
5. [Sorun Giderme](#sorun-giderme)

---

## Genel Bakış

NeoList, Zimbra mail sunucusuyla entegre çalışarak:
- ✅ NeoList'te oluşturulan görevleri kullanıcıların Zimbra Tasks'ına senkronize eder
- ✅ Kullanıcının klasör paylaşmasına gerek kalmadan görev oluşturabilir
- ✅ Admin SOAP API ile merkezi yönetim sağlar

### Desteklenen Zimbra Versiyonları

| Versiyon | Destek |
|----------|--------|
| Zimbra 8.8.x | ✅ Tam destek |
| Zimbra 9.x | ✅ Tam destek |
| Zimbra 10.x | ✅ Tam destek |

---

## Nasıl Çalışır?

NeoList, Zimbra ile iki farklı yöntemle iletişim kurar:

### 1. CalDAV API (Port 443)
- Kullanıcı Tasks klasörünü admin ile paylaştığında kullanılır
- Daha hızlı ve düşük yük
- `/dav/{email}/Tasks/` endpoint'i

### 2. Admin SOAP API (Port 7071)
- Kullanıcı paylaşım yapmadığında otomatik devreye girer
- DelegateAuth ile kullanıcı adına işlem yapar
- Paylaşım gerektirmez, tüm kullanıcılar için çalışır

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   NeoList   │────▶│  CalDAV (443)    │────▶│   Zimbra    │
│             │     │  veya            │     │   Tasks     │
│   Görev     │────▶│  SOAP API (7071) │────▶│             │
└─────────────┘     └──────────────────┘     └─────────────┘
```

### Fallback Mekanizması

```
createZimbraTask(userEmail, task)
    │
    ├──▶ CalDAV ile dene
    │       │
    │       ├──▶ Başarılı? → ✅ Tamamlandı
    │       │
    │       └──▶ 404/403 hatası?
    │               │
    │               └──▶ Admin SOAP API ile dene
    │                       │
    │                       └──▶ ✅ Tamamlandı
```

---

## Yapılandırma

### 1. Ortam Değişkenleri

`.env.local` dosyasına ekleyin:

```env
# Zimbra Sunucu Adresi (https:// olmadan)
ZIMBRA_HOST=mail.example.com

# Admin Hesap Bilgileri
# Bu hesap Admin SOAP API erişimine sahip olmalı
ZIMBRA_ADMIN_EMAIL=admin@example.com
ZIMBRA_ADMIN_PASSWORD=admin_şifresi
```

### 2. Zimbra Admin Hesabı Gereksinimleri

Admin hesabının şu yetkilere sahip olması gerekir:
- `adminLoginAs` - Başka kullanıcılar adına oturum açma
- `domainAdminRights` - Domain yönetim hakları

Zimbra'da bu yetkileri vermek için:

```bash
# Zimbra sunucusunda
zmprov ma admin@domain.com +zimbraIsDelegatedAdminAccount TRUE
zmprov grr domain domain.com usr admin@domain.com +adminLoginAs
```

### 3. Port Erişimi

Sunucunuzdan Zimbra'ya şu portların açık olduğundan emin olun:

| Port | Protokol | Kullanım |
|------|----------|----------|
| 443 | HTTPS | CalDAV API |
| 7071 | HTTPS | Admin SOAP API |

```bash
# Port testi
telnet webmail.domain.com 443
telnet webmail.domain.com 7071
```

---

## Özellikler

### Görev Oluşturma

```typescript
import { createZimbraTask } from '@/lib/zimbra-sync'

const result = await createZimbraTask('user@domain.com', {
    title: 'Raporu hazırla',
    notes: 'Detaylı açıklama...',
    due_date: new Date('2024-02-01'),
    priority: 'high'
})

if (result.success) {
    console.log('Görev oluşturuldu:', result.uid)
} else {
    console.error('Hata:', result.error)
}
```

### Görev Güncelleme

```typescript
import { updateZimbraTask } from '@/lib/zimbra-sync'

const result = await updateZimbraTask('user@domain.com', taskUid, {
    title: 'Güncellenmiş başlık',
    is_completed: 1
})
```

### Görevleri Listeleme

```typescript
import { getZimbraTasks } from '@/lib/zimbra-sync'

const result = await getZimbraTasks('user@domain.com')
if (result.success) {
    result.tasks?.forEach(task => {
        console.log(task.title, task.status)
    })
}
```

### Toplu Senkronizasyon

```typescript
import { syncTasksToZimbra } from '@/lib/zimbra-sync'

// Kullanıcının tüm görevlerini Zimbra'ya senkronize et
const result = await syncTasksToZimbra('user@domain.com', userId)
console.log(`${result.synced} görev senkronize edildi`)
```

---

## Test Etme

### Manuel Test

```bash
# Belirli bir kullanıcı için test
npx tsx -e "
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createZimbraTask } from './src/lib/zimbra-sync'

createZimbraTask('user@domain.com', {
    title: 'Test Görev - ' + new Date().toLocaleTimeString(),
    notes: 'Test açıklaması',
    priority: 'normal'
}).then(r => console.log(r))
"
```

### Test Script'i

```bash
# test-zimbra-fallback.ts dosyasını çalıştırın
npx tsx test-zimbra-fallback.ts
```

---

## Sorun Giderme

### 1. "Yetkilendirme hatası" (401)

**Olası Nedenler:**
- Admin şifresi yanlış
- Admin hesabının yetkileri yetersiz

**Çözüm:**
```bash
# Şifreyi kontrol edin
echo $ZIMBRA_ADMIN_PASSWORD

# Zimbra'da yetkileri kontrol edin
zmprov ga admin@domain.com | grep zimbraIs
```

### 2. "Bağlantı hatası" (ECONNREFUSED)

**Olası Nedenler:**
- Port kapalı
- Firewall engelliyor
- Yanlış host adresi

**Çözüm:**
```bash
# Port testi
nc -zv webmail.domain.com 443
nc -zv webmail.domain.com 7071

# DNS kontrolü
nslookup webmail.domain.com
```

### 3. "SSL sertifika hatası"

**Olası Nedenler:**
- Self-signed sertifika
- Süresi dolmuş sertifika

**Çözüm:**
Eğer test ortamında self-signed sertifika kullanıyorsanız, `zimbra-sync.ts` dosyasında:

```typescript
// Sadece geliştirme ortamı için!
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
```

### 4. CalDAV 404 hatası

Bu beklenen bir durumdur - kullanıcı Tasks klasörünü paylaşmamışsa 404 döner ve sistem otomatik olarak Admin SOAP API'ye geçer.

Log çıktısı:
```
CalDAV erişimi yok (404), Admin API ile deneniyor...
✅ Görev oluşturuldu! UID: xxx
```

---

## Performans Optimizasyonu

### Token Önbellekleme

Admin auth token'ı 1 saat boyunca önbellekte tutulur, her istekte yeni token alınmaz.

### Bağlantı Havuzu

CalDAV bağlantıları HTTP keep-alive ile yeniden kullanılır.

### Toplu İşlemler

Çok sayıda görev senkronize ederken `syncTasksToZimbra` fonksiyonunu kullanın - tek tek `createZimbraTask` çağırmaktan daha verimlidir.

---

## API Referansı

### Fonksiyonlar

| Fonksiyon | Açıklama |
|-----------|----------|
| `createZimbraTask(email, task)` | Görev oluştur (otomatik fallback) |
| `updateZimbraTask(email, uid, task)` | Görev güncelle |
| `deleteZimbraTask(email, uid)` | Görev sil |
| `getZimbraTasks(email)` | Görevleri listele |
| `syncTasksToZimbra(email, userId)` | NeoList → Zimbra senkronizasyon |
| `syncTasksFromZimbra(email, userId)` | Zimbra → NeoList senkronizasyon |
| `checkZimbraAccess(email)` | CalDAV erişim kontrolü |

### Tipler

```typescript
interface ZimbraCreateResult {
    success: boolean
    uid?: string
    etag?: string
    error?: string
}

interface ZimbraTask {
    uid: string
    title: string
    notes?: string
    due_date?: Date
    priority?: string
    status?: string
    is_completed?: number
}
```

---

## İlgili Dosyalar

- [src/lib/zimbra-sync.ts](../src/lib/zimbra-sync.ts) - Ana senkronizasyon modülü
- [test-zimbra-fallback.ts](../test-zimbra-fallback.ts) - Test scripti
