#!/usr/bin/env node
/**
 * NeoList - Otomatik Kurulum Scripti
 * Bu script, projeyi sıfırdan kurmak için gerekli tüm adımları otomatik olarak yapar.
 * 
 * Kullanım: node scripts/setup.js
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

const question = (q) => new Promise(resolve => rl.question(q, resolve))

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
}

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✔${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✖${colors.reset} ${msg}`),
    warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    step: (num, msg) => console.log(`\n${colors.cyan}${colors.bold}[${num}]${colors.reset} ${msg}`)
}

async function main() {
    console.log(`
${colors.cyan}${colors.bold}
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ███╗   ██╗███████╗ ██████╗ ██╗     ██╗███████╗████████╗ ║
║   ████╗  ██║██╔════╝██╔═══██╗██║     ██║██╔════╝╚══██╔══╝ ║
║   ██╔██╗ ██║█████╗  ██║   ██║██║     ██║███████╗   ██║    ║
║   ██║╚██╗██║██╔══╝  ██║   ██║██║     ██║╚════██║   ██║    ║
║   ██║ ╚████║███████╗╚██████╔╝███████╗██║███████║   ██║    ║
║   ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚══════╝╚═╝╚══════╝   ╚═╝    ║
║                                                           ║
║          Görev Yönetim Sistemi - Kurulum Sihirbazı        ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`)

    log.step(1, 'Sistem gereksinimleri kontrol ediliyor...')
    
    // Node.js version check
    const nodeVersion = process.version.match(/^v(\d+)/)[1]
    if (parseInt(nodeVersion) < 18) {
        log.error(`Node.js 18+ gerekli. Mevcut: ${process.version}`)
        process.exit(1)
    }
    log.success(`Node.js ${process.version} uygun`)

    // Check if npm is available
    try {
        execSync('npm --version', { stdio: 'pipe' })
        log.success('npm mevcut')
    } catch {
        log.error('npm bulunamadı. Lütfen Node.js kurulumunu kontrol edin.')
        process.exit(1)
    }

    log.step(2, 'Ortam değişkenleri ayarlanıyor...')
    
    const envPath = path.join(process.cwd(), '.env.local')
    const envExamplePath = path.join(process.cwd(), '.env.example')
    
    if (!fs.existsSync(envPath)) {
        if (fs.existsSync(envExamplePath)) {
            fs.copyFileSync(envExamplePath, envPath)
            log.success('.env.example dosyası .env.local olarak kopyalandı')
        } else {
            log.warn('.env.example bulunamadı, .env.local oluşturuluyor...')
            await createEnvFile(envPath)
        }
        log.warn('Lütfen .env.local dosyasını düzenleyerek gerekli değerleri girin!')
    } else {
        log.success('.env.local zaten mevcut')
    }

    log.step(3, 'Bağımlılıklar yükleniyor...')
    
    try {
        execSync('npm install', { stdio: 'inherit' })
        log.success('Bağımlılıklar yüklendi')
    } catch (error) {
        log.error('Bağımlılık yüklemesi başarısız')
        process.exit(1)
    }

    log.step(4, 'Veritabanı migrasyonları çalıştırılıyor...')
    
    const runMigrations = await question('Veritabanı migrasyonlarını çalıştırmak ister misiniz? (e/h): ')
    if (runMigrations.toLowerCase() === 'e') {
        try {
            execSync('npx tsx scripts/db/migrate.ts', { stdio: 'inherit' })
            log.success('Migrasyonlar tamamlandı')
        } catch (error) {
            log.warn('Migrasyon hatası. Veritabanı bağlantınızı kontrol edin.')
        }
    } else {
        log.info('Migrasyonlar atlandı')
    }

    log.step(5, 'Proje derleniyor...')
    
    try {
        execSync('npm run build', { stdio: 'inherit' })
        log.success('Proje derlendi')
    } catch (error) {
        log.error('Derleme başarısız. Hataları kontrol edin.')
        process.exit(1)
    }

    console.log(`
${colors.green}${colors.bold}
╔═══════════════════════════════════════════════════════════╗
║                   KURULUM TAMAMLANDI!                     ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}
Sonraki adımlar:

  ${colors.cyan}1.${colors.reset} .env.local dosyasını düzenleyin (eğer yapmadıysanız)
  ${colors.cyan}2.${colors.reset} Geliştirme modunda başlatmak için: ${colors.yellow}npm run dev${colors.reset}
  ${colors.cyan}3.${colors.reset} Prodüksiyon modunda başlatmak için: ${colors.yellow}npm start${colors.reset}
  ${colors.cyan}4.${colors.reset} PM2 ile başlatmak için: ${colors.yellow}pm2 start ecosystem.config.js${colors.reset}

Dökümantasyon:
  - ${colors.blue}docs/KURULUM.md${colors.reset} - Detaylı kurulum rehberi
  - ${colors.blue}docs/API.md${colors.reset} - API dökümantasyonu
  - ${colors.blue}docs/TELEGRAM.md${colors.reset} - Telegram bot kurulumu
  - ${colors.blue}docs/ZIMBRA.md${colors.reset} - Zimbra entegrasyonu

Sorun mu yaşıyorsunuz? ${colors.blue}docs/SORUN_GIDERME.md${colors.reset} dosyasına bakın.
`)

    rl.close()
}

async function createEnvFile(envPath) {
    const envContent = `# NeoList Ortam Değişkenleri
# Bu dosyayı .env.local olarak kaydedin ve değerleri doldurun

# ═══════════════════════════════════════════════════════════
# ZORUNLU AYARLAR
# ═══════════════════════════════════════════════════════════

# Oracle Veritabanı Bağlantısı
ORACLE_USER=your_oracle_user
ORACLE_PASSWORD=your_oracle_password
ORACLE_CONNECTION_STRING=your_oracle_host:1521/your_service_name

# NextAuth.js (Oturum Yönetimi)
AUTH_SECRET=your-super-secret-key-min-32-chars
NEXTAUTH_URL=http://localhost:3000

# ═══════════════════════════════════════════════════════════
# OPSIYONEL AYARLAR
# ═══════════════════════════════════════════════════════════

# Telegram Bot Entegrasyonu
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/telegram/webhook

# Zimbra Mail Entegrasyonu
ZIMBRA_HOST=webmail.yourdomain.com
ZIMBRA_ADMIN_EMAIL=admin@yourdomain.com
ZIMBRA_ADMIN_PASSWORD=admin_password

# Uygulama Ayarları
NODE_ENV=development
PORT=3000
`
    fs.writeFileSync(envPath, envContent)
    log.success('.env.local şablonu oluşturuldu')
}

main().catch(err => {
    log.error(`Kurulum hatası: ${err.message}`)
    process.exit(1)
})
