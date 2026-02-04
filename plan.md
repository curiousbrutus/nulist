# Plan: Zimbra-Telegram-NeoList Tam Entegrasyonu

**Amaç:** Görev yönetimini 3 platform arasında senkronize etmek - görev oluşturulduğunda Zimbra'ya yazılsın, atandığında Telegram'dan bildirim gitsin, Telegram'dan durum güncellenebilsin.

## Mimari

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   NeoList   │ ◄─────► │   Oracle    │ ◄─────► │   Zimbra    │
│   (Web UI)  │         │   (Master)  │         │  (CalDAV)   │
└─────────────┘         └─────────────┘         └─────────────┘
       │                       │                       │
       │                       │                       │
       └───────────────────────┼───────────────────────┘
                               │
                               ▼
                       ┌─────────────┐
                       │  Telegram   │
                       │   (Read +   │
                       │  Notify)    │
                       └─────────────┘
```

**Master:** Oracle Database - Tüm CRUD Oracle'da yapılır, Zimbra'ya async push

## Steps

### 1. Merkezi bildirim servisi oluştur
- [ ] `src/lib/notifications.ts` dosyası oluştur
- [ ] `notifyViaZimbra(task, userEmail)` - Zimbra CalDAV'a task yaz
- [ ] `notifyViaTelegram(userId, message)` - Telegram mesajı gönder
- [ ] `notifyViaEmail(userEmail, subject, body)` - Email bildirimi (opsiyonel)

### 2. Event hook sistemi kur
- [ ] `src/lib/integration-hooks.ts` dosyası oluştur
- [ ] `onTaskCreated(task, assignees)` - Zimbra sync + Telegram bildirim
- [ ] `onTaskUpdated(task, changes)` - Zimbra güncelle
- [ ] `onTaskAssigned(task, assignee)` - Telegram "size görev atandı" bildirimi
- [ ] `onTaskCompleted(task, completedBy)` - Zimbra status sync + Telegram bildirim

### 3. Task API'lerini güncelle
- [ ] `src/app/api/tasks/route.ts` - POST sonrasına `onTaskCreated()` hook çağrısı ekle
- [ ] `src/app/api/tasks/[id]/route.ts` oluştur - PUT/DELETE için `onTaskUpdated()` hook

### 4. Telegram bot geliştir
- [ ] `/newtask <başlık>` komutu - Hızlı görev oluşturma
- [ ] Görev atama bildirimi - "📋 Size yeni görev atandı: {title}"
- [ ] Due date yaklaşınca hatırlatıcı
- [ ] Inline keyboard ile hızlı durum güncelleme

### 5. Background sync job
- [ ] Cron endpoint: `/api/cron/sync-zimbra`
- [ ] Saatlik Zimbra→NeoList sync (Zimbra'da yapılan değişiklikleri çek)
- [ ] Due date reminder cron - Yarın/bugün bitecek görevler için Telegram bildirimi

## Dosya Değişiklikleri

| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `src/lib/notifications.ts` | YENİ | Merkezi bildirim servisi |
| `src/lib/integration-hooks.ts` | YENİ | Task event hook'ları |
| `src/app/api/tasks/[id]/route.ts` | YENİ | Task PUT/DELETE endpoint |
| `src/app/api/tasks/route.ts` | GÜNCELLE | POST sonrası hook çağrısı |
| `src/lib/telegram-bot.ts` | GÜNCELLE | Bildirim + yeni komutlar |
| `src/lib/zimbra-sync.ts` | GÜNCELLE | syncTasksFromZimbra DB update |
| `src/store/task-store.ts` | GÜNCELLE | API sonrası hook tetikleme |

## Kararlar

### Sync Yönü
- [x] **Çift yönlü** - Oracle master, Zimbra'ya realtime push, Zimbra'dan saatlik pull
- [ ] Tek yönlü - Sadece NeoList→Zimbra

### Telegram'dan Görev Oluşturma
- [ ] Evet - `/newtask` komutu ile hızlı görev
- [ ] Hayır - Sadece görüntüleme ve durum güncelleme

### Conflict Resolution
- [x] **Last-modified wins** - En son güncellenen versiyon geçerli
- [ ] Master wins - Oracle her zaman kazanır

## Dikkat Edilecekler

1. **Zimbra Rate Limiting** - Batch işlem kullan, her task için ayrı HTTP call yapma
2. **Telegram Flood Control** - Queue ile mesaj gönder, spam yapma
3. **Error Handling** - Sync hataları log'a yazılsın, kullanıcıya gösterilmesin
4. **User Preference** - `zimbra_sync_enabled = 0` olan kullanıcıları sync'e dahil etme
5. **Async Processing** - Webhook response'u bekletme, background'da işle
