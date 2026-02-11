module.exports = {
    apps: [
        {
            name: 'neolist',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            cwd: 'C:\\Users\\Administrator\\Desktop\\neolist',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                TNS_ADMIN: 'C:\\app\\oracle\\product\\12.1.0\\client_1\\network\\admin',
                ORACLE_HOME: 'C:\\app\\oracle\\product\\12.1.0\\client_1',
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
            cwd: 'C:\\Users\\Administrator\\Desktop\\neolist',
            env: {
                NODE_ENV: 'production',
                TNS_ADMIN: 'C:\\app\\oracle\\product\\12.1.0\\client_1\\network\\admin',
                ORACLE_HOME: 'C:\\app\\oracle\\product\\12.1.0\\client_1',
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
            cwd: 'C:\\Users\\Administrator\\Desktop\\neolist',
            env: {
                NODE_ENV: 'production',
                TNS_ADMIN: 'C:\\app\\oracle\\product\\12.1.0\\client_1\\network\\admin',
                ORACLE_HOME: 'C:\\app\\oracle\\product\\12.1.0\\client_1',
                NLS_LANG: 'TURKISH_TURKEY.AL32UTF8'
            },
            instances: 1,
            autorestart: true,
            watch: false,
            restart_delay: 300000 // 5 minutes
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