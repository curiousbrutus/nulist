module.exports = {
    apps: [
        {
            name: 'neolist',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            cwd: 'C:/Users/muhammet/Desktop/wunderlist',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            }
        }
    ]
}

// pm2 start ecosystem.config.js