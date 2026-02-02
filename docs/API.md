# API Referansı

Bu dokümantasyon, NeoList'in REST API endpoint'lerini açıklar.

---

## 📋 İçindekiler

1. [Genel Bilgiler](#genel-bilgiler)
2. [Kimlik Doğrulama](#kimlik-doğrulama)
3. [Görevler API](#görevler-api)
4. [Klasörler API](#klasörler-api)
5. [Listeler API](#listeler-api)
6. [Kullanıcılar API](#kullanıcılar-api)
7. [Admin API](#admin-api)
8. [Hata Kodları](#hata-kodları)

---

## Genel Bilgiler

### Base URL

```
Geliştirme: http://localhost:3000/api
Prodüksiyon: https://neolist.domain.com/api
```

### İstek Formatı

- Content-Type: `application/json`
- Karakter seti: UTF-8

### Yanıt Formatı

Tüm yanıtlar JSON formatındadır:

```json
{
  "success": true,
  "data": { ... },
  "message": "İşlem başarılı"
}
```

Hata durumunda:

```json
{
  "success": false,
  "error": "Hata mesajı",
  "code": "ERROR_CODE"
}
```

---

## Kimlik Doğrulama

NeoList, NextAuth.js tabanlı session kimlik doğrulaması kullanır.

### Oturum Açma

```http
POST /api/auth/callback/credentials
Content-Type: application/json

{
  "email": "user@domain.com",
  "password": "şifre"
}
```

### Oturum Kontrolü

```http
GET /api/auth/session
```

Yanıt:
```json
{
  "user": {
    "id": "123",
    "email": "user@domain.com",
    "name": "Kullanıcı Adı",
    "role": "admin"
  },
  "expires": "2024-02-01T00:00:00.000Z"
}
```

---

## Görevler API

### Görevleri Listele

```http
GET /api/tasks
```

Query Parametreleri:

| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `list_id` | string | Belirli liste için filtrele |
| `status` | string | `pending`, `completed`, `all` |
| `due_date` | string | Tarih filtresi (YYYY-MM-DD) |
| `assignee_id` | string | Atanan kişiye göre filtrele |
| `limit` | number | Sayfa boyutu (varsayılan: 50) |
| `offset` | number | Başlangıç indeksi |

Örnek:
```http
GET /api/tasks?list_id=abc123&status=pending&limit=10
```

Yanıt:
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task-123",
        "title": "Raporu hazırla",
        "notes": "Detaylı açıklama",
        "due_date": "2024-02-01T00:00:00.000Z",
        "priority": "high",
        "is_completed": 0,
        "assignee_id": "user-456",
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "total": 45,
    "limit": 10,
    "offset": 0
  }
}
```

### Görev Detayı

```http
GET /api/tasks/{id}
```

### Görev Oluştur

```http
POST /api/tasks
Content-Type: application/json

{
  "title": "Yeni görev",
  "notes": "Açıklama",
  "list_id": "list-123",
  "due_date": "2024-02-01",
  "priority": "normal",
  "assignee_id": "user-456"
}
```

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `title` | string | ✅ | Görev başlığı |
| `notes` | string | ❌ | Detaylı açıklama |
| `list_id` | string | ✅ | Hedef liste ID'si |
| `due_date` | string | ❌ | Bitiş tarihi (ISO 8601) |
| `priority` | string | ❌ | `low`, `normal`, `high` |
| `assignee_id` | string | ❌ | Atanan kullanıcı ID'si |

### Görev Güncelle

```http
PUT /api/tasks/{id}
Content-Type: application/json

{
  "title": "Güncellenmiş başlık",
  "is_completed": 1
}
```

### Görev Sil

```http
DELETE /api/tasks/{id}
```

### Görevi Tamamla

```http
POST /api/tasks/{id}/complete
```

### Görevi Yeniden Aç

```http
POST /api/tasks/{id}/reopen
```

---

## Klasörler API

### Klasörleri Listele

```http
GET /api/folders
```

Yanıt:
```json
{
  "success": true,
  "data": [
    {
      "id": "folder-123",
      "name": "Pazarlama",
      "color": "#3498db",
      "icon": "folder",
      "lists_count": 5,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Klasör Oluştur

```http
POST /api/folders
Content-Type: application/json

{
  "name": "Yeni Klasör",
  "color": "#e74c3c",
  "icon": "briefcase"
}
```

### Klasör Güncelle

```http
PUT /api/folders/{id}
Content-Type: application/json

{
  "name": "Güncellenmiş İsim"
}
```

### Klasör Sil

```http
DELETE /api/folders/{id}
```

---

## Listeler API

### Listeleri Getir

```http
GET /api/lists
GET /api/lists?folder_id=folder-123
```

### Liste Oluştur

```http
POST /api/lists
Content-Type: application/json

{
  "name": "Yeni Liste",
  "folder_id": "folder-123"
}
```

### Liste Güncelle

```http
PUT /api/lists/{id}
Content-Type: application/json

{
  "name": "Güncellenmiş Liste"
}
```

### Liste Sil

```http
DELETE /api/lists/{id}
```

---

## Kullanıcılar API

### Profil Bilgisi

```http
GET /api/users/me
```

Yanıt:
```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "email": "user@domain.com",
    "name": "Kullanıcı Adı",
    "role": "user",
    "department": "Pazarlama",
    "avatar_url": "/uploads/avatars/user-123.jpg",
    "telegram_connected": true,
    "zimbra_email": "user@zimbra.domain.com"
  }
}
```

### Profil Güncelle

```http
PUT /api/users/me
Content-Type: application/json

{
  "name": "Yeni İsim",
  "department": "IT"
}
```

### Şifre Değiştir

```http
POST /api/users/me/change-password
Content-Type: application/json

{
  "current_password": "eski_şifre",
  "new_password": "yeni_güçlü_şifre"
}
```

### Takım Üyeleri

```http
GET /api/users
```

---

## Admin API

> ⚠️ Bu endpoint'ler sadece admin rolüne sahip kullanıcılar tarafından kullanılabilir.

### Tüm Kullanıcıları Listele

```http
GET /api/admin/users
```

### Kullanıcı Oluştur

```http
POST /api/admin/users
Content-Type: application/json

{
  "email": "yeni@domain.com",
  "name": "Yeni Kullanıcı",
  "password": "güçlü_şifre",
  "role": "user",
  "department": "IT"
}
```

### Kullanıcı Rolü Değiştir

```http
PUT /api/admin/users/{id}/role
Content-Type: application/json

{
  "role": "admin"
}
```

### Kullanıcı Sil

```http
DELETE /api/admin/users/{id}
```

### Sistem İstatistikleri

```http
GET /api/admin/stats
```

Yanıt:
```json
{
  "success": true,
  "data": {
    "total_users": 150,
    "active_users": 120,
    "total_tasks": 5420,
    "completed_tasks": 4100,
    "pending_tasks": 1320,
    "tasks_today": 45
  }
}
```

### Audit Log

```http
GET /api/admin/audit-log
```

Query Parametreleri:

| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `user_id` | string | Belirli kullanıcı |
| `action` | string | `create`, `update`, `delete` |
| `from` | string | Başlangıç tarihi |
| `to` | string | Bitiş tarihi |

---

## Hata Kodları

| Kod | HTTP Status | Açıklama |
|-----|-------------|----------|
| `UNAUTHORIZED` | 401 | Oturum açılmamış |
| `FORBIDDEN` | 403 | Yetkisiz erişim |
| `NOT_FOUND` | 404 | Kaynak bulunamadı |
| `VALIDATION_ERROR` | 400 | Geçersiz parametre |
| `DUPLICATE_ENTRY` | 409 | Kayıt zaten mevcut |
| `INTERNAL_ERROR` | 500 | Sunucu hatası |
| `DB_ERROR` | 500 | Veritabanı hatası |

Hata Yanıt Örneği:
```json
{
  "success": false,
  "error": "Görev bulunamadı",
  "code": "NOT_FOUND"
}
```

---

## Rate Limiting

API istekleri rate limiting'e tabidir:

| Endpoint | Limit |
|----------|-------|
| Genel | 100 istek/dakika |
| Auth | 10 istek/dakika |
| Admin | 50 istek/dakika |

Rate limit aşıldığında:
```json
{
  "success": false,
  "error": "Rate limit aşıldı. Lütfen bekleyin.",
  "code": "RATE_LIMITED",
  "retry_after": 60
}
```

---

## Webhook Events

NeoList, belirli olaylarda webhook bildirimleri gönderebilir.

### Desteklenen Olaylar

| Olay | Açıklama |
|------|----------|
| `task.created` | Yeni görev oluşturuldu |
| `task.updated` | Görev güncellendi |
| `task.completed` | Görev tamamlandı |
| `task.deleted` | Görev silindi |

### Webhook Payload

```json
{
  "event": "task.completed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "task_id": "task-123",
    "title": "Raporu hazırla",
    "completed_by": "user-456"
  }
}
```

---

## SDK ve Örnekler

### JavaScript/TypeScript

```typescript
// fetch ile
const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        title: 'Yeni görev',
        list_id: 'list-123'
    })
})
const data = await response.json()
```

### cURL

```bash
# Görev oluştur
curl -X POST https://neolist.domain.com/api/tasks \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=xxx" \
  -d '{"title":"Test görev","list_id":"list-123"}'
```

### Python

```python
import requests

session = requests.Session()
session.cookies.set('next-auth.session-token', 'xxx')

response = session.post('https://neolist.domain.com/api/tasks', json={
    'title': 'Test görev',
    'list_id': 'list-123'
})
print(response.json())
```
