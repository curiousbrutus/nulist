# Katkıda Bulunma Rehberi

NeoList'e katkıda bulunmak istediğiniz için teşekkürler! Bu rehber, projeye nasıl katkıda bulunabileceğinizi açıklar.

---

## 🚀 Hızlı Başlangıç

1. Projeyi fork edin
2. Geliştirme ortamınızı kurun
3. Değişikliklerinizi yapın
4. Test edin
5. Pull Request açın

---

## 📁 Proje Yapısı

```
neolist/
├── docs/           # Dokümantasyon (Türkçe)
├── migrations/     # Veritabanı migrasyonları
├── public/         # Statik dosyalar
├── scripts/        # Yardımcı scriptler
│   ├── setup.js    # Kurulum scripti
│   └── db/         # Veritabanı scriptleri
├── src/            # Kaynak kodlar
│   ├── app/        # Next.js App Router
│   ├── components/ # React bileşenleri
│   ├── lib/        # Servisler ve kütüphaneler
│   ├── hooks/      # React hooks
│   ├── store/      # Zustand state yönetimi
│   ├── types/      # TypeScript tipleri
│   └── utils/      # Yardımcı fonksiyonlar
├── tests/          # Test dosyaları
└── _trash/         # Eski/kullanılmayan dosyalar
```

---

## 🛠️ Geliştirme Ortamı

### Kurulum

```bash
# Projeyi klonlayın
git clone https://github.com/your-username/neolist.git
cd neolist

# Bağımlılıkları yükleyin
npm install

# Ortam değişkenlerini ayarlayın
cp .env.example .env.local
# .env.local dosyasını düzenleyin

# Geliştirme sunucusunu başlatın
npm run dev
```

### Kullanışlı Komutlar

```bash
npm run dev          # Geliştirme sunucusu
npm run build        # Prodüksiyon derlemesi
npm run lint         # Kod kalite kontrolü
npm test             # Testleri çalıştır
npm run db:migrate   # Veritabanı migrasyonları
```

---

## 📝 Kod Standartları

### TypeScript

- Strict mode aktif
- `any` kullanımından kaçının
- Interface'leri tip tanımları için tercih edin
- Tüm fonksiyonlar için parametre ve dönüş tipleri belirtin

```typescript
// ✅ Doğru
interface Task {
    id: string
    title: string
    completed: boolean
}

function createTask(data: Partial<Task>): Task {
    // ...
}

// ❌ Yanlış
function createTask(data: any): any {
    // ...
}
```

### React Bileşenleri

- Fonksiyonel bileşenler kullanın
- Props için interface tanımlayın
- Bileşen dosya adları PascalCase olmalı

```typescript
// components/TaskCard.tsx
interface TaskCardProps {
    task: Task
    onComplete: (id: string) => void
}

export function TaskCard({ task, onComplete }: TaskCardProps) {
    return (
        // ...
    )
}
```

### Dosya İsimlendirme

| Tür | Format | Örnek |
|-----|--------|-------|
| Bileşenler | PascalCase | `TaskCard.tsx` |
| Hooks | camelCase, use* | `useAuth.ts` |
| Utilityler | camelCase | `formatDate.ts` |
| API Routes | kebab-case | `route.ts` |
| Tipler | PascalCase | `Task.ts` |

---

## 🧪 Test Yazma

### Unit Test

```typescript
// tests/utils/formatDate.test.ts
import { describe, it, expect } from 'vitest'
import { formatDate } from '@/utils/formatDate'

describe('formatDate', () => {
    it('should format date correctly', () => {
        const date = new Date('2024-01-15')
        expect(formatDate(date)).toBe('15 Ocak 2024')
    })
})
```

### Testleri Çalıştırma

```bash
npm test              # İzleme modunda
npm run test:run      # Tek seferlik
```

---

## 📤 Pull Request Süreci

### 1. Branch Oluşturma

```bash
git checkout -b feature/amazing-feature
```

Branch adlandırma:
- `feature/` - Yeni özellikler
- `fix/` - Bug düzeltmeleri
- `docs/` - Dokümantasyon
- `refactor/` - Kod yeniden düzenleme

### 2. Commit Mesajları

[Conventional Commits](https://www.conventionalcommits.org/) formatını kullanın:

```
<tip>(<kapsam>): <açıklama>

[isteğe bağlı gövde]

[isteğe bağlı footer]
```

Tipler:
- `feat` - Yeni özellik
- `fix` - Bug düzeltmesi
- `docs` - Dokümantasyon
- `style` - Kod formatı (fonksiyon değişikliği yok)
- `refactor` - Refactoring
- `test` - Test ekleme/düzeltme
- `chore` - Build, config vs.

Örnekler:
```
feat(tasks): add due date reminder notification
fix(auth): resolve session timeout issue
docs(readme): update installation instructions
```

### 3. Pull Request Açma

1. Değişikliklerinizi push edin:
   ```bash
   git push origin feature/amazing-feature
   ```

2. GitHub'da Pull Request açın

3. PR açıklamasında şunları belirtin:
   - Değişikliğin amacı
   - Test edilme şekli
   - Ekran görüntüleri (UI değişikliklerinde)

### 4. Code Review

- En az 1 onay gerekli
- Tüm testler geçmeli
- Lint hataları olmamalı

---

## 🐛 Bug Raporlama

GitHub Issues'da yeni issue açın ve şunları belirtin:

1. **Özet** - Kısa açıklama
2. **Beklenen Davranış** - Ne olmalıydı?
3. **Gerçekleşen Davranış** - Ne oldu?
4. **Adımlar** - Bug'ı nasıl tetikleyebiliriz?
5. **Ortam** - Node.js versiyonu, OS, tarayıcı

---

## 💡 Özellik Önerisi

GitHub Issues'da "Feature Request" etiketi ile issue açın:

1. **Problem** - Hangi sorunu çözüyor?
2. **Çözüm Önerisi** - Nasıl çalışmalı?
3. **Alternatifler** - Başka yaklaşımlar var mı?

---

## 📚 Kaynaklar

- [Next.js Dokümantasyonu](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Oracle Node.js Documentation](https://oracle.github.io/node-oracledb/)

---

## 📞 İletişim

Sorularınız için:
- GitHub Issues
- Email: dev@example.com

---

Katkılarınız için teşekkürler! 🙏
