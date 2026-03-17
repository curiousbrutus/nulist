module.exports = {
    apps: [
        {
            name: 'neolist',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            cwd: process.env.APP_CWD || process.cwd(),
            env: {
                NODE_ENV: 'production',
                PORT: 4554,
                TNS_ADMIN: process.env.TNS_ADMIN || '',
                ORACLE_HOME: process.env.ORACLE_HOME || '',
                NLS_LANG: 'TURKISH_TURKEY.AL32UTF8'
            },
            instances: 1,
            exec_mode: 'cluster',
            merge_logs: true,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
        },
        {
            name: 'zimbra-queue-worker',
            script: 'scripts/services/queue_worker.ts',
            interpreter: 'node',
            node_args: '--import tsx',
            cwd: process.env.APP_CWD || process.cwd(),
            env: {
                NODE_ENV: 'production',
                TNS_ADMIN: process.env.TNS_ADMIN || '',
                ORACLE_HOME: process.env.ORACLE_HOME || '',
                NLS_LANG: 'TURKISH_TURKEY.AL32UTF8'
            },
            instances: 1,
            autorestart: true,
            watch: false
        },
        {
            name: 'zimbra-incoming-sync',
            script: 'scripts/cron/sync_zimbra_incoming.ts',
            interpreter: 'node',
            node_args: '--import tsx',
            cwd: process.env.APP_CWD || process.cwd(),
            env: {
                NODE_ENV: 'production',
                TNS_ADMIN: process.env.TNS_ADMIN || '',
                ORACLE_HOME: process.env.ORACLE_HOME || '',
                NLS_LANG: 'TURKISH_TURKEY.AL32UTF8'
            },
            instances: 1,
            autorestart: true,
            watch: false,
            restart_delay: 300000 // 5 minutes
        },
        {
            name: 'notification-worker',
            script: 'scripts/services/notification_worker.ts',
            interpreter: 'node',
            node_args: '--import tsx',
            cwd: process.env.APP_CWD || process.cwd(),
            env: {
                NODE_ENV: 'production',
                TNS_ADMIN: process.env.TNS_ADMIN || '',
                ORACLE_HOME: process.env.ORACLE_HOME || '',
                NLS_LANG: 'TURKISH_TURKEY.AL32UTF8'
            },
            instances: 1,
            autorestart: true,
            watch: false,
            restart_delay: 10000
        },
        {
            name: 'notifications-scheduler',
            script: 'scripts/cron/notifications_scheduler.ts',
            interpreter: 'node',
            node_args: '--import tsx',
            cwd: process.env.APP_CWD || process.cwd(),
            env: {
                NODE_ENV: 'production',
                TNS_ADMIN: process.env.TNS_ADMIN || '',
                ORACLE_HOME: process.env.ORACLE_HOME || '',
                NLS_LANG: 'TURKISH_TURKEY.AL32UTF8'
            },
            instances: 1,
            autorestart: true,
            watch: false,
            restart_delay: 60000
        },
        {
            name: 'nginx',
            script: process.env.NGINX_BIN || 'nginx',
            args: process.env.NGINX_ARGS || '',
            interpreter: 'none',
            autorestart: true,
            watch: false
        },
        {
            name: 'telegram-polling-bridge',
            script: 'scripts/telegram/polling-bridge.js',
            cwd: process.env.APP_CWD || process.cwd(),
            env: {
                NODE_ENV: 'production',
                APP_PORT: 4554
            },
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_memory_restart: '300M',
            error_file: './logs/telegram-polling-err.log',
            out_file: './logs/telegram-polling-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
        }
    ]
}

// Commands:
// pm2 start ecosystem.config.js
// pm2 stop neolist
// pm2 restart neolist
// pm2 delete neolist
// pm2 logs neolist
// pm2 startup
// pm2 save