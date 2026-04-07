# Sunucu Operasyon Know-How (Caddy + PM2 + Node.js + Oracle)

Bu doküman, NeoList/Anket benzeri uygulamaları güvenli ve sürdürülebilir şekilde yayınlamak için standart çalışma modelini özetler.

## 1) Hedef Mimari

- Uygulamalar iç portlarda çalışır (ör. `3001`, `4554`).
- Public giriş noktası reverse proxy (`Caddy`) üzerinden `80/443` portudur.
- Node süreçleri `PM2` ile yönetilir.
- Veritabanı Oracle’dır.

## 2) Yayın Standardı (Yeni Domain/Subdomain)

1. Uygulama PM2 ile iç portta ayağa kaldırılır.
2. `Caddyfile` içine host kuralı eklenir (`domain -> local_port`).
3. `pm2 restart caddy-proxy` ile proxy yenilenir.
4. HTTPS sertifikası ve yönlendirmeler doğrulanır.
5. `pm2 save` ile durum kalıcı hale getirilir.

## 3) Caddy Modeli

Ana dosya: `Caddyfile`

Örnek:

```caddy
{
  admin off
  email admin@example.com
  storage file_system C:\caddy\data
}

example.domain.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:4554
}
```

Notlar:
- `storage file_system` sertifika dosyalarının kalıcı olması için önemlidir.
- Host bazlı ayrı bloklar çoklu proje yönetimini sadeleştirir.

## 4) PM2 Standart Komutları

```powershell
pm2 list
pm2 logs <app>
pm2 restart <app>
pm2 save
```

## 5) Windows Reboot Sonrası Otomatik Kalkış

Bu ortamda `pm2 startup` her zaman çalışmayabilir. Güvenilir yöntem:

- Task Scheduler ile `pm2 resurrect` çalıştıran bir görev tanımlanır.
- Örnek görev adı: `PM2-Resurrect-NeoList`
- Örnek script: `scripts/startup/pm2-resurrect.bat`

Doğrulama:

```powershell
schtasks /Query /TN "PM2-Resurrect-NeoList" /V /FO LIST
```

Beklenen:
- `Scheduled Task State: Enabled`
- `Last Result: 0`

## 6) TLS / Sertifika Karar Ağacı

1. **Önerilen:** Caddy ACME (Let's Encrypt) ile otomatik sertifika.
2. Eğer ACME erişimi ağ tarafında kısıtlıysa geçici fallback uygulanır.
3. Kurumsal wildcard kullanılacaksa private key veya doğru PFX zorunludur.

Kritik:
- `.crt` tek başına yeterli değildir.
- Sertifika eşleşmesi için `cert + private key` veya `pfx + passphrase` gerekir.

## 7) Incident (Hızlı Müdahale)

```powershell
pm2 list
pm2 logs caddy-proxy --lines 200 --nostream
netstat -ano | findstr ":80 "
netstat -ano | findstr ":443 "
curl.exe -I https://example.domain.com/
```

## 8) Güvenlik Politikası

- `.env`, private key, pfx, parola dosyaları repoya girmez.
- Sertifika/private key materyali sadece sunucuda, sınırlı erişimle tutulur.
- Repo’da yalnızca güvenli örnek dosyalar (`.env.example`) kalır.
- Operasyon notlarında gerçek parola/token paylaşılmaz.

## 9) Yedekleme Minimumları

- Kod deposu (git remote)
- PM2 dump (`pm2 save`)
- `Caddyfile` yedeği
- Sertifika/anahtar dosyaları (şifreli kasada)
- Oracle export

## 10) Kurtarma Sırası

1. Sunucu bağımlılıkları kurulur (Node, PM2, Caddy, Oracle client).
2. Repo çekilir.
3. `.env` yüklenir.
4. PM2 süreçleri ayağa kaldırılır.
5. Caddy yapılandırması uygulanır.
6. Health/login/dış erişim testleri tamamlanır.

---

Bu doküman yaşayan bir rehberdir; altyapı değiştikçe güncellenmelidir.
