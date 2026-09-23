module.exports = {
  apps: [
    {
      name: "daemon",
      script: "npx",
      args: "tsx scripts/daemon.ts",
      cwd: __dirname,
      // Otomatik yeniden başlatma ayarları
      autorestart: true,
      max_restarts: 999999,       // Sınırsız yeniden başlatma
      min_uptime: "10s",          // 10 saniyeden kısa yaşayan süreç = crash
      restart_delay: 15000,       // Crash sonrası 15 saniye bekle
      max_memory_restart: "500M", // 500MB RAM aşarsa yeniden başlat
      // Loglama
      error_file: "./logs/daemon-error.log",
      out_file: "./logs/daemon-out.log",
      log_date_format: "DD.MM.YYYY HH:mm:ss",
      merge_logs: true,
      // Ortam değişkenleri (WARP proxy ile çalışıyorsa)
      env: {
        NODE_ENV: "production",
        DISABLE_ZENROWS: "true",
      },
      // process.exit(0) durumunu crash olarak sayma
      stop_exit_codes: [0],
      // Cron ile gece 4'te yeniden başlat (hafıza temizliği)
      cron_restart: "0 4 * * *",
      // Watch modunu kapat (git pull kendi kendine halleder)
      watch: false,
    },
  ],
};
