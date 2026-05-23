// PM2 进程管理配置
// 宝塔面板 → 软件商店 → 安装 PM2 管理器后使用
module.exports = {
  apps: [
    {
      name: 'agenthub',
      script: './dist/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      // 日志
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      // 自动重启
      max_memory_restart: '512M',
      autorestart: true,
      watch: false,
      // 监听文件变化排除
      ignore_watch: ['node_modules', 'database', 'logs', '.env'],
      // 优雅退出
      kill_timeout: 5000,
      wait_ready: false
    }
  ]
}
