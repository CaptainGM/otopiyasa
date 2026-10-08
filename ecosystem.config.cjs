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
        // 945 MB RAM'li sunucuda sistem ajanları ~430 MB tutuyor; süreç bellek tavanını aşınca makine takas diskinde boğulup donuyordu
        // (8 Eki 2026, ssh bile yanıt vermedi). Heap sınırı sürecin kendisini yavaş değil net hatayla durdurur, pm2 yeniden başlatır.
        NODE_OPTIONS: "--max-old-space-size=360",
      },
      autorestart: true,
      restart_delay: 5000,
      // Makine kilitlenmeden önce şişen süreci yeniden başlat (eskiden 600M: kullanılabilir RAM'in üstündeydi).
      max_memory_restart: "420M",
      log_date_format: "DD.MM.YYYY HH:mm:ss",
      merge_logs: true,
      watch: false,
    },
  ],
};
