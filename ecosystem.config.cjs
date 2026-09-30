// pm2 ile 7/24 veri motoru. Sunucuda bu dosyayla çalışan uygulamanın adı `otopiyasa-daemon`.
// Gereksinim: tsx global kurulu olmalı (`sudo npm i -g tsx pm2`).
module.exports = {
  apps: [
    {
      name: "otopiyasa-daemon",
      script: "tsx",
      args: "scripts/daemon.ts",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        DISABLE_ZENROWS: "true",
        SCRAPE_CONCURRENCY: "1",
        SCRAPE_MIN_INTERVAL_MS: "4500",
      },
      autorestart: true,
      restart_delay: 5000,
      // 1 GB RAM'li sunucuda şişen süreci yeniden başlat.
      max_memory_restart: "600M",
      log_date_format: "DD.MM.YYYY HH:mm:ss",
      merge_logs: true,
      watch: false,
    },
  ],
};
