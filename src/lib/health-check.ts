import { Car } from "@/models/Car";
import { DaemonHeartbeat } from "@/models/ScrapeMetric";
import { HOME_WATCHER_ID, HomeWatcherHour, HomeWatcherState } from "@/models/HomeWatcher";
import { SourceSyncState } from "@/models/SourceSyncState";
import { SystemAlert } from "@/models/SystemAlert";
import { User } from "@/models/User";
import { RECONCILE_SOURCES } from "@/lib/scraper/reconcile-sources";

/**
 * KENDİNİ İZLEYEN SİSTEM: site, sunucu motoru (Oracle) ve evdeki bekçi bir şey bozulduğunda yöneticiye haber verir;
 * her şey yolundayken sessizdir. Denetim saatte bir sunucu motorundan, günde bir Vercel zamanlayıcısından çalışır
 * (motor çökmüşse onu da Vercel yakalar). Aynı sorun için günde en fazla bir bildirim; düzelince bir kez "düzeldi".
 */

export interface HealthIssue {
  key: string;
  severity: "critical" | "warning";
  title: string;
  detail: string;
}

export const HEALTH = {
  /** Sunucu motoru bu süre sinyal vermezse durmuş sayılır. */
  daemonSilentMs: 45 * 60 * 1000,
  /** Evdeki bilgisayar her gün açık olmayabilir; bekçi için eşik uzun. */
  watcherSilentMs: 3 * 24 * 60 * 60 * 1000,
  /** Kurumsal kaynak bu süre başarıyla senkronlanmazsa haber verilir. */
  sourceStaleMs: 3 * 24 * 60 * 60 * 1000,
  /** Bu süre hiç yeni ilan eklenmezse haber verilir. */
  noNewListingsMs: 48 * 60 * 60 * 1000,
  /** Bekçinin son 24 saatte açtığı sayfaların bu oranından fazlası okunamadıysa site yapısı değişmiş olabilir. */
  maxUncertainRatio: 0.5,
  minCheckedForRatio: 40,
  /** Aynı sorun için tekrar bildirim aralığı. */
  renotifyMs: 24 * 60 * 60 * 1000,
};

const hours = (ms: number) => Math.round(ms / 3_600_000);

export interface HealthSnapshot {
  now: Date;
  daemon?: { lastHeartbeat?: Date | null; command?: string; status?: string } | null;
  watcher?: { lastHeartbeat?: Date | null } | null;
  watcherLast24h: { checked: number; uncertain: number; blocked: number };
  sources: Array<{ source: string; lastSuccessAt?: Date | null; lastStatus?: string; lastMessage?: string }>;
  lastListingCreatedAt?: Date | null;
}

/** Ölçümlerden sorun listesi çıkarır (veritabanına dokunmaz; test edilebilir). */
export function evaluateHealth(s: HealthSnapshot): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const now = s.now.getTime();
  const age = (d?: Date | null) => (d ? now - new Date(d).getTime() : Infinity);

  const daemonStopped = s.daemon?.command === "stop" || s.daemon?.status === "stopped";
  if (!daemonStopped && age(s.daemon?.lastHeartbeat) > HEALTH.daemonSilentMs) {
    issues.push({
      key: "daemon-silent",
      severity: "critical",
      title: "Sunucu motoru durmuş görünüyor",
      detail: s.daemon?.lastHeartbeat
        ? `Oracle sunucusundaki motor ${hours(age(s.daemon.lastHeartbeat))} saattir sinyal vermiyor. Kurumsal kaynaklar ve otomatik bakım çalışmıyor.`
        : "Sunucu motorundan hiç sinyal kaydı yok.",
    });
  }

  if (age(s.watcher?.lastHeartbeat) > HEALTH.watcherSilentMs) {
    issues.push({
      key: "watcher-silent",
      severity: "warning",
      title: "Evdeki bekçi uzun süredir çalışmıyor",
      detail: s.watcher?.lastHeartbeat
        ? `Bekçi ${Math.round(age(s.watcher.lastHeartbeat) / 86_400_000)} gündür sinyal vermiyor; Arabam ilanları doğrulanmıyor ve yeni ilan eklenmiyor. Bilgisayar açıldığında kendiliğinden başlar.`
        : "Bekçiden hiç sinyal kaydı yok.",
    });
  }

  const w = s.watcherLast24h;
  if (w.checked >= HEALTH.minCheckedForRatio && w.uncertain / w.checked > HEALTH.maxUncertainRatio) {
    issues.push({
      key: "watcher-parse",
      severity: "critical",
      title: "İlan sayfaları okunamıyor",
      detail: `Bekçinin son 24 saatte açtığı ${w.checked} sayfanın ${w.uncertain} tanesi tanınamadı. Kaynak site sayfa yapısını değiştirmiş olabilir; ayrıştırıcı güncellenmeli.`,
    });
  }

  for (const src of s.sources) {
    // Yalnızca otomatik senkronlanan kurumsal kaynaklar (bkz. reconcile.ts RECONCILE_SOURCES).
    if (!(RECONCILE_SOURCES as readonly string[]).includes(src.source)) continue;
    if (age(src.lastSuccessAt) > HEALTH.sourceStaleMs) {
      issues.push({
        key: `source-${src.source}`,
        severity: "warning",
        title: `${src.source} senkronlanamıyor`,
        detail: `Son başarılı tam senkron: ${src.lastSuccessAt ? `${Math.round(age(src.lastSuccessAt) / 86_400_000)} gün önce` : "hiç"}. Son durum: ${src.lastStatus || "?"} ${src.lastMessage ? `(${src.lastMessage.slice(0, 120)})` : ""}`.trim(),
      });
    }
  }

  if (age(s.lastListingCreatedAt) > HEALTH.noNewListingsMs) {
    issues.push({
      key: "no-new-listings",
      severity: "warning",
      title: "Yeni ilan gelmiyor",
      detail: `Son ${hours(age(s.lastListingCreatedAt))} saattir hiçbir kaynaktan yeni ilan eklenmedi.`,
    });
  }
  return issues;
}

export async function collectHealthSnapshot(now = new Date()): Promise<HealthSnapshot> {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [daemon, watcher, hoursRows, sources, lastCar] = await Promise.all([
    DaemonHeartbeat.findOne({ daemonId: "primary-daemon" }).select("lastHeartbeat command status").lean<HealthSnapshot["daemon"]>(),
    HomeWatcherState.findOne({ watcherId: HOME_WATCHER_ID }).select("lastHeartbeat").lean<HealthSnapshot["watcher"]>(),
    HomeWatcherHour.find({ watcherId: HOME_WATCHER_ID, timestamp: { $gte: dayAgo } })
      .select("checked uncertain blocked")
      .lean<Array<{ checked?: number; uncertain?: number; blocked?: number }>>(),
    SourceSyncState.find({}).select("source lastSuccessAt lastStatus lastMessage").lean<HealthSnapshot["sources"]>(),
    Car.findOne({}).sort({ createdAt: -1 }).select("createdAt").lean<{ createdAt?: Date } | null>(),
  ]);
  const sum = (k: "checked" | "uncertain" | "blocked") => hoursRows.reduce((s, r) => s + (r[k] || 0), 0);
  return {
    now,
    daemon,
    watcher,
    watcherLast24h: { checked: sum("checked"), uncertain: sum("uncertain"), blocked: sum("blocked") },
    sources: sources || [],
    lastListingCreatedAt: lastCar?.createdAt ?? null,
  };
}

export interface HealthRunResult {
  issues: HealthIssue[];
  notified: string[];
  resolved: string[];
}

/**
 * Denetimi çalıştırır, sorunları kaydeder ve yöneticilere (e-posta + web/mobil bildirim) haber verir.
 * `notify: false` yalnızca durumu günceller (yönetim paneli için).
 */
export async function runHealthCheck(options: { notify?: boolean; now?: Date } = {}): Promise<HealthRunResult> {
  const now = options.now ?? new Date();
  const issues = evaluateHealth(await collectHealthSnapshot(now));
  const notified: string[] = [];
  const resolved: string[] = [];
  const toSend: Array<HealthIssue & { resolved?: boolean }> = [];

  for (const issue of issues) {
    const existing = await SystemAlert.findOne({ key: issue.key }).lean<{ lastNotifiedAt?: Date | null; resolvedAt?: Date | null } | null>();
    const isNew = !existing || existing.resolvedAt;
    await SystemAlert.updateOne(
      { key: issue.key },
      {
        $set: { severity: issue.severity, title: issue.title, detail: issue.detail, lastSeenAt: now, resolvedAt: null },
        ...(isNew ? { $setOnInsert: { firstSeenAt: now } } : {}),
      },
      { upsert: true }
    );
    if (isNew && existing) await SystemAlert.updateOne({ key: issue.key }, { $set: { firstSeenAt: now } });
    const due = isNew || !existing?.lastNotifiedAt || now.getTime() - new Date(existing.lastNotifiedAt).getTime() > HEALTH.renotifyMs;
    if (due) toSend.push(issue);
  }

  const openAlerts = await SystemAlert.find({ resolvedAt: null }).select("key title").lean<Array<{ key: string; title: string }>>();
  for (const alert of openAlerts) {
    if (issues.some((i) => i.key === alert.key)) continue;
    await SystemAlert.updateOne({ key: alert.key }, { $set: { resolvedAt: now } });
    resolved.push(alert.key);
    toSend.push({ key: alert.key, severity: "warning", title: `Düzeldi: ${alert.title}`, detail: "Sorun kendiliğinden giderildi.", resolved: true });
  }

  if (options.notify !== false && toSend.length > 0) {
    await notifyAdmins(toSend);
    for (const item of toSend) {
      if (!item.resolved) await SystemAlert.updateOne({ key: item.key }, { $set: { lastNotifiedAt: now } });
      notified.push(item.key);
    }
  }
  return { issues, notified, resolved };
}

async function notifyAdmins(items: Array<HealthIssue & { resolved?: boolean }>): Promise<void> {
  const admins = await User.find({ role: "admin" }).select("_id email").lean<Array<{ _id: unknown; email?: string }>>();
  if (admins.length === 0) return;
  const critical = items.some((i) => i.severity === "critical" && !i.resolved);
  const title = items.length === 1 ? items[0].title : `OtoPiyasa: ${items.length} sistem bildirimi`;
  const body = items.map((i) => `${i.title}: ${i.detail}`).join("\n");

  const { createNotification } = await import("@/lib/notify");
  for (const admin of admins) {
    await createNotification({ userId: String(admin._id), type: "system", title, body: body.slice(0, 500), link: "/admin" });
  }
  try {
    const { sendPushToUsers } = await import("@/lib/web-push");
    await sendPushToUsers(admins.map((a) => String(a._id)), { title, body: body.slice(0, 180), url: "/admin" });
  } catch (error) {
    console.error("Sağlık bildirimi (push) gönderilemedi:", error);
  }
  try {
    const { isMailerConfigured, sendEmail, escapeHtml } = await import("@/lib/mailer");
    if (!isMailerConfigured()) return;
    const html =
      `<h2 style="margin:0 0 12px">${critical ? "⚠️ " : ""}OtoPiyasa sistem denetimi</h2>` +
      items.map((i) => `<p><strong>${escapeHtml(i.title)}</strong><br>${escapeHtml(i.detail)}</p>`).join("") +
      `<p style="color:#888;font-size:12px">Bu e-posta yalnızca bir şey bozulduğunda ya da düzeldiğinde gönderilir; aynı sorun için günde en fazla bir kez.</p>`;
    for (const admin of admins) {
      if (admin.email) await sendEmail({ to: admin.email, subject: title, html, text: body });
    }
  } catch (error) {
    console.error("Sağlık bildirimi (e-posta) gönderilemedi:", error);
  }
}
