module.exports = {
  apps: [
    {
      name: 'luci-backend',
      script: './src/app.js',
      cwd: '/opt/luci-customs/backend',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      listen_timeout: 10000,
      kill_timeout: 5000,
      wait_ready: false,
      autorestart: true,
      watch: false
    },
    {
      name: 'luci-ai-service',
      script: './main.py',
      cwd: '/opt/luci-customs/ai-service',
      interpreter: '/opt/luci-customs/ai-service/venv/bin/python3',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      error_file: '/opt/luci-customs/ai-service/logs/pm2-error.log',
      out_file: '/opt/luci-customs/ai-service/logs/pm2-out.log',
      autorestart: true,
      watch: false
    }
  ]
};
