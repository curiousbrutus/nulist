# NeoList - Görev Yönetim Sistemi

<div align="center">

**Modern, hızlı ve entegre görev yönetim platformu**

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Oracle](https://img.shields.io/badge/Oracle-Database-red?logo=oracle)](https://www.oracle.com/database/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot-blue?logo=telegram)](https://core.telegram.org/bots)

[Dokümantasyon](docs/) • [Kurulum](#-hızlı-kurulum) • [Katkıda Bulunun](#-katkıda-bulunun)

</div>

---

## 📋 İçindekiler

- [Özellikler](#-özellikler)
- [Hızlı Kurulum](#-hızlı-kurulum)
- [Gereksinimler](#-gereksinimler)
- [Detaylı Kurulum](#-detaylı-kurulum)
- [Proje Yapısı](#-proje-yapısı)
- [Entegrasyonlar](#-entegrasyonlar)
- [API Referansı](#-api-referansı)
- [Katkıda Bulunun](#-katkıda-bulunun)

---

## ✨ Özellikler

### Temel Özellikler
- 📝 **Görev Yönetimi** - Oluştur, düzenle, sil, tamamla
- 📁 **Klasör Organizasyonu** - Görevleri kategorilere ayır
- 👥 **Takım Yönetimi** - Kullanıcılara görev ata
- 🔍 **Akıllı Arama** - Görevlerde hızlı arama
- 📊 **Dashboard** - İstatistikler ve genel bakış

### Entegrasyonlar
- 🤖 **Telegram Bot** - Telegram üzerinden görev yönetimi
- 📧 **Zimbra Senkronizasyon** - Mail görevleriyle otomatik senkronizasyon
- 📤 **Excel Dışa Aktarım** - Raporları Excel olarak indir

### Kurumsal Özellikler
- 🔐 **Rol Tabanlı Yetkilendirme** - Admin, Manager, User rolleri
- 📈 **Audit Log** - Tüm işlemlerin kaydı
- 🏢 **Çoklu Departman Desteği** - Departman bazlı organizasyon

---

## 🚀 Hızlı Kurulum

### Tek Komutla Kurulum

```bash
# Projeyi klonlayın
git clone https://github.com/your-org/neolist.git
cd neolist

# Otomatik kurulum scriptini çalıştırın
npm run setup
```

### Manuel Kurulum

```bash
# 1. Bağımlılıkları yükleyin
npm install

# 2. Ortam değişkenlerini ayarlayın
cp .env.example .env.local
# .env.local dosyasını düzenleyin

# 3. Veritabanı migrasyonlarını çalıştırın
npm run db:migrate

# 4. Uygulamayı başlatın
npm run dev          # Geliştirme modu
npm run build && npm start  # Prodüksiyon modu
```

---

## 📦 Gereksinimler

| Yazılım | Minimum Versiyon | Açıklama |
|---------|-----------------|----------|
| Node.js | 18.0+ | JavaScript runtime |
| npm | 9.0+ | Paket yöneticisi |
| Oracle Database | 19c+ | Veritabanı |
| Oracle Instant Client | 19.0+ | Oracle bağlantısı için |

### Oracle Instant Client Kurulumu

<details>
<summary><b>Windows</b></summary>

1. [Oracle Instant Client](https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html) indirin
2. `C:\oracle\instantclient_19_XX` klasörüne çıkarın
3. Sistem PATH'ine ekleyin
4. `TNS_ADMIN` ortam değişkenini ayarlayın (opsiyonel)

</details>

<details>
<summary><b>Linux (Ubuntu/Debian)</b></summary>

```bash
# Gerekli paketleri yükleyin
sudo apt-get install libaio1

# Oracle Instant Client'ı indirin ve kurun
wget https://download.oracle.com/otn_software/linux/instantclient/instantclient-basiclite-linuxx64.zip
unzip instantclient-basiclite-linuxx64.zip -d /opt/oracle
echo /opt/oracle/instantclient* | sudo tee /etc/ld.so.conf.d/oracle-instantclient.conf
sudo ldconfig
```

</details>

<details>
<summary><b>macOS</b></summary>

```bash
# Homebrew ile yükleyin
brew tap InstantClientTap/instantclient
brew install instantclient-basic
```

</details>

---

## 📖 Detaylı Kurulum

Detaylı kurulum rehberi için: **[docs/KURULUM.md](docs/KURULUM.md)**

### Prodüksiyon Dağıtımı

```bash
# PM2 ile çalıştırma
npm install -g pm2
pm2 start ecosystem.config.js

# Docker ile çalıştırma (yakında)
docker-compose up -d
```

Detaylı dağıtım rehberi için: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

---

## 📁 Proje Yapısı

```
neolist/
├── 📁 docs/                    # Dokümantasyon
│   ├── KURULUM.md             # Detaylı kurulum rehberi
│   ├── API.md                 # API referansı
│   ├── TELEGRAM.md            # Telegram bot kurulumu
│   ├── ZIMBRA.md              # Zimbra entegrasyonu
│   └── SORUN_GIDERME.md       # Sık karşılaşılan sorunlar
│
├── 📁 migrations/              # Veritabanı migrasyonları
│   ├── 001_initial_schema.sql
│   └── ...
│
├── 📁 public/                  # Statik dosyalar
│   └── uploads/               # Kullanıcı yüklemeleri
│
├── 📁 scripts/                 # Yardımcı scriptler
│   ├── setup.js               # Otomatik kurulum
│   └── db/
│       └── migrate.ts         # Migrasyon scripti
│
├── 📁 src/                     # Kaynak kodlar
│   ├── 📁 app/                # Next.js App Router
│   │   ├── api/              # API endpoint'leri
│   │   ├── admin/            # Admin paneli
│   │   └── ...               # Diğer sayfalar
│   │
│   ├── 📁 components/         # React bileşenleri
│   │   ├── ui/               # Temel UI bileşenleri
│   │   ├── tasks/            # Görev bileşenleri
│   │   └── layout/           # Layout bileşenleri
│   │
│   ├── 📁 lib/                # Kütüphane/servisler
│   │   ├── oracle.ts         # Veritabanı bağlantısı
│   │   ├── telegram-bot.ts   # Telegram bot servisi
│   │   └── zimbra-sync.ts    # Zimbra senkronizasyon
│   │
│   ├── 📁 hooks/              # React hooks
│   ├── 📁 store/              # Zustand state yönetimi
│   ├── 📁 types/              # TypeScript tipleri
│   └── 📁 utils/              # Yardımcı fonksiyonlar
│
├── 📁 tests/                   # Test dosyaları
│   ├── api/                   # API testleri
│   └── integration/           # Entegrasyon testleri
│
├── .env.example               # Ortam değişkenleri şablonu
├── ecosystem.config.js        # PM2 yapılandırması
├── package.json              # Proje bağımlılıkları
└── README.md                 # Bu dosya
```

---

## 🔌 Entegrasyonlar

### Telegram Bot

Telegram üzerinden görev oluşturma ve yönetim:

```
/gorev Raporu hazırla - yarına kadar
/liste - Görevlerimi listele
/tamamla 5 - 5 numaralı görevi tamamla
```

Kurulum: **[docs/TELEGRAM.md](docs/TELEGRAM.md)**

### Zimbra Senkronizasyon

Zimbra Tasks ile çift yönlü senkronizasyon:
- NeoList'te oluşturulan görevler → Zimbra
- Zimbra'da oluşturulan görevler → NeoList

Kurulum: **[docs/ZIMBRA.md](docs/ZIMBRA.md)**

---

## 📡 API Referansı

### Görevler

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/tasks` | Görevleri listele |
| POST | `/api/tasks` | Yeni görev oluştur |
| PUT | `/api/tasks/[id]` | Görev güncelle |
| DELETE | `/api/tasks/[id]` | Görev sil |

### Klasörler

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/folders` | Klasörleri listele |
| POST | `/api/folders` | Yeni klasör oluştur |

Tam API referansı: **[docs/API.md](docs/API.md)**

---

## 🛠️ Geliştirme

```bash
# Geliştirme sunucusunu başlat
npm run dev

# Testleri çalıştır
npm test

# Lint kontrolü
npm run lint

# Tip kontrolü
npx tsc --noEmit
```

---

## 🤝 Katkıda Bulunun

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: Add amazing feature'`)
4. Branch'i push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

---

## 📄 Lisans

Bu proje özel lisans altındadır. Tüm hakları saklıdır.

---

## 📞 Destek

- 📧 Email: support@example.com
- 💬 Telegram: Sistem yöneticinize başvurun

---

<div align="center">
  <sub>❤️ Optimed için geliştirildi</sub>
</div>
