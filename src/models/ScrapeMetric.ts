import mongoose, { Schema, Document } from "mongoose";

export interface IHourlyScrapeStat extends Document {
  timestamp: Date;
  dateStr: string;
  hourRange: string;
  scanned: number;
  inserted: number;
  updated: number;
  deleted: number;
  bySource: {
    arabam: { scanned: number; inserted: number; updated: number; deleted: number };
    otomerkezi: { scanned: number; inserted: number; updated: number; deleted: number };
    vavacars: { scanned: number; inserted: number; updated: number; deleted: number };
    otoplus?: { scanned: number; inserted: number; updated: number; deleted: number };
    carvak?: { scanned: number; inserted: number; updated: number; deleted: number };
  };
  diagnostics?: {
    totalRequests: number;
    successRequests: number;
    failedRequests: number;
    rateLimitHits: number;
    healthStatus: "success" | "warning" | "error";
    statusCode: number;
    statusLabel: string;
    explanation: string;
  };
  lastUpdated: Date;
}

const HourlyScrapeStatSchema = new Schema<IHourlyScrapeStat>(
  {
    timestamp: { type: Date, required: true, unique: true, index: true },
    dateStr: { type: String, required: true, index: true },
    hourRange: { type: String, required: true },
    scanned: { type: Number, default: 0 },
    inserted: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    deleted: { type: Number, default: 0 },
    diagnostics: { type: Schema.Types.Mixed, default: undefined },
    bySource: {
      arabam: {
        scanned: { type: Number, default: 0 },
        inserted: { type: Number, default: 0 },
        updated: { type: Number, default: 0 },
        deleted: { type: Number, default: 0 },
      },
      otomerkezi: {
        scanned: { type: Number, default: 0 },
        inserted: { type: Number, default: 0 },
        updated: { type: Number, default: 0 },
        deleted: { type: Number, default: 0 },
      },
      vavacars: {
        scanned: { type: Number, default: 0 },
        inserted: { type: Number, default: 0 },
        updated: { type: Number, default: 0 },
        deleted: { type: Number, default: 0 },
      },
      otoplus: {
        scanned: { type: Number, default: 0 },
        inserted: { type: Number, default: 0 },
        updated: { type: Number, default: 0 },
        deleted: { type: Number, default: 0 },
      },
      carvak: {
        scanned: { type: Number, default: 0 },
        inserted: { type: Number, default: 0 },
        updated: { type: Number, default: 0 },
        deleted: { type: Number, default: 0 },
      },
      otokoc: {
        scanned: { type: Number, default: 0 },
        inserted: { type: Number, default: 0 },
        updated: { type: Number, default: 0 },
        deleted: { type: Number, default: 0 },
      },
      dod: {
        scanned: { type: Number, default: 0 },
        inserted: { type: Number, default: 0 },
        updated: { type: Number, default: 0 },
        deleted: { type: Number, default: 0 },
      },
      ikinciyeni: {
        scanned: { type: Number, default: 0 },
        inserted: { type: Number, default: 0 },
        updated: { type: Number, default: 0 },
        deleted: { type: Number, default: 0 },
      },
    },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const HourlyScrapeStat =
  mongoose.models.HourlyScrapeStat ||
  mongoose.model<IHourlyScrapeStat>("HourlyScrapeStat", HourlyScrapeStatSchema);

export interface IDaemonHeartbeat extends Document {
  daemonId: string;
  host: string;
  status: "online" | "idle" | "stopped";
  command?: "run" | "stop";
  mode?: "hybrid" | "new_only" | "sweep_only";
  currentPhase: string;
  cycle: number;
  memoryMb: number;
  uptimeSeconds: number;
  recentLogs?: string[];
  lastHeartbeat: Date;
}

const DaemonHeartbeatSchema = new Schema<IDaemonHeartbeat>(
  {
    daemonId: { type: String, required: true, unique: true, default: "primary-daemon" },
    host: { type: String, default: "Oracle Cloud Always Free (Frankfurt)" },
    status: { type: String, enum: ["online", "idle", "stopped"], default: "online" },
    command: { type: String, enum: ["run", "stop"], default: "run" },
    mode: { type: String, enum: ["hybrid", "new_only", "sweep_only"], default: "hybrid" },
    currentPhase: { type: String, default: "Başlatılıyor" },
    cycle: { type: Number, default: 1 },
    memoryMb: { type: Number, default: 45 },
    uptimeSeconds: { type: Number, default: 0 },
    recentLogs: { type: [String], default: [] },
    lastHeartbeat: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const DaemonHeartbeat =
  mongoose.models.DaemonHeartbeat ||
  mongoose.model<IDaemonHeartbeat>("DaemonHeartbeat", DaemonHeartbeatSchema);

/**
 * Saatlik tarama metriklerini MongoDB'ye atomik ($inc) olarak kaydeder.
 */
export async function recordHourlyMetric({
  source,
  scanned = 0,
  inserted = 0,
  updated = 0,
  deleted = 0,
  diagnostics,
}: {
  source: "arabam" | "otomerkezi" | "vavacars" | "other" | string;
  scanned?: number;
  inserted?: number;
  updated?: number;
  deleted?: number;
  diagnostics?: any;
}) {
  try {
    const now = new Date();
    // Türkiye saati (UTC+3 Europe/Istanbul)
    const trParts = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const getP = (type: string) => trParts.find((p) => p.type === type)?.value || "00";

    const day = getP("day");
    const month = getP("month");
    const year = parseInt(getP("year"), 10);
    const hour = parseInt(getP("hour"), 10);
    const nextHour = (hour + 1) % 24;

    const hourRange = `${String(hour).padStart(2, "0")}:00 - ${String(nextHour).padStart(2, "0")}:00`;
    const dateStr = `${day}.${month}.${year}`;

    // Saatin başlangıç noktası (Türkiye saatine denk gelen UTC anı)
    const timestamp = new Date(Date.UTC(year, parseInt(month, 10) - 1, parseInt(day, 10), hour - 3, 0, 0, 0));

    const safeSource = [
      "arabam",
      "otomerkezi",
      "vavacars",
      "otoplus",
      "carvak",
      "otokoc",
      "dod",
      "ikinciyeni",
    ].includes(source)
      ? source
      : "arabam";

    const setFields: Record<string, any> = { dateStr, hourRange, lastUpdated: new Date() };
    if (diagnostics) {
      setFields.diagnostics = diagnostics;
    }

    await HourlyScrapeStat.findOneAndUpdate(
      { timestamp },
      {
        $set: setFields,
        $inc: {
          scanned: Math.max(0, scanned),
          inserted: Math.max(0, inserted),
          updated: Math.max(0, updated),
          deleted: Math.max(0, deleted),
          [`bySource.${safeSource}.scanned`]: Math.max(0, scanned),
          [`bySource.${safeSource}.inserted`]: Math.max(0, inserted),
          [`bySource.${safeSource}.updated`]: Math.max(0, updated),
          [`bySource.${safeSource}.deleted`]: Math.max(0, deleted),
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("[ScrapeMetric] recordHourlyMetric hatası:", err);
  }
}

/**
 * 7/24 Daemon'un canlı olduğunu belirten kalp atışı (heartbeat) günceller.
 */
export async function updateDaemonHeartbeat({
  phase,
  cycle = 1,
  status = "online",
  memoryMb,
  uptimeSeconds,
  mode,
  recentLogs,
}: {
  phase: string;
  cycle?: number;
  status?: "online" | "idle" | "stopped";
  memoryMb?: number;
  uptimeSeconds?: number;
  mode?: "hybrid" | "new_only" | "sweep_only";
  recentLogs?: string[];
}) {
  try {
    const memory = memoryMb || Math.round(process.memoryUsage().rss / (1024 * 1024));
    const uptime = uptimeSeconds || Math.round(process.uptime());

    const updatePayload: Record<string, any> = {
      currentPhase: phase,
      cycle,
      status,
      memoryMb: memory,
      uptimeSeconds: uptime,
      lastHeartbeat: new Date(),
    };
    if (mode) {
      updatePayload.mode = mode;
    }
    if (recentLogs && recentLogs.length > 0) {
      updatePayload.recentLogs = recentLogs;
    }

    await DaemonHeartbeat.findOneAndUpdate(
      { daemonId: "primary-daemon" },
      {
        $set: updatePayload,
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("[ScrapeMetric] updateDaemonHeartbeat hatası:", err);
  }
}

/**
 * Bulut veya yereldeki tüm daemon motorlarına uzaktan Durdur/Başlat komutu gönderir.
 */
export async function setDaemonControl(command: "run" | "stop", phase?: string) {
  try {
    const isStop = command === "stop";
    await DaemonHeartbeat.findOneAndUpdate(
      { daemonId: "primary-daemon" },
      {
        $set: {
          command,
          status: isStop ? "stopped" : "online",
          currentPhase:
            phase ||
            (isStop
              ? "🛑 Durduruldu (Panelden 'Motoru Başlat' ile çalıştırılabilir)"
              : "🚀 Otonom Motor Aktif - Canlı Taramalar Devam Ediyor..."),
          lastHeartbeat: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("[ScrapeMetric] setDaemonControl hatası:", err);
  }
}

/**
 * Daemon motorunun çalışma modunu (hibrit / sadece yeni ilan / sadece ölü temizliği) ayarlar.
 */
export async function setDaemonMode(mode: "hybrid" | "new_only" | "sweep_only") {
  try {
    await DaemonHeartbeat.findOneAndUpdate(
      { daemonId: "primary-daemon" },
      {
        $set: {
          mode,
          lastHeartbeat: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("[ScrapeMetric] setDaemonMode hatası:", err);
  }
}

/**
 * Daemon motorunun durumunu ve seçili çalışma modunu döndürür.
 */
export async function getDaemonControl(): Promise<{
  command: "run" | "stop";
  status: string;
  mode: "hybrid" | "new_only" | "sweep_only";
}> {
  try {
    const hb = await DaemonHeartbeat.findOne({ daemonId: "primary-daemon" }).lean<any>();
    const command = hb?.command || (hb?.status === "stopped" ? "stop" : "run");
    const mode = (hb?.mode as "hybrid" | "new_only" | "sweep_only") || "hybrid";
    return { command, status: hb?.status || "online", mode };
  } catch {
    return { command: "run", status: "online", mode: "hybrid" };
  }
}

