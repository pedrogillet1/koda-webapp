module.exports = {
  apps: [{
    name: 'koda-backend',
    script: './dist/server.js',
    cwd: '/home/koda/koda-webapp/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    error_file: '/home/koda/koda-webapp/backend/logs/pm2-error.log',
    out_file: '/home/koda/koda-webapp/backend/logs/pm2-out.log',
    log_file: '/home/koda/koda-webapp/backend/logs/pm2-combined.log',
    time: true,
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    kill_timeout: 5000,
    node_args: '-r dotenv/config'
  }]
};
