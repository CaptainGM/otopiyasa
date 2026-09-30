/** Kalp atışı 15 sn'de bir gelir; bundan eski ise motor gerçekten çalışmıyor demektir. */
export const HEARTBEAT_STALE_MS = 3 * 60 * 1000;

export interface DaemonStatus {
  isOnline: boolean;
  heartbeatAgeSec: number | null;
  host: string;
  currentPhase: string;
  cycle: number;
  memoryMb: number | null;
  uptimeSeconds: number;
  lastHeartbeat: string | null;
  status: "online" | "idle" | "stopped" | "offline";
  command: "run" | "stop" | "restart";
  mode: "hybrid" | "new_only" | "sweep_only";
  recentLogs: string[];
}

type HeartbeatLike = {
  host?: string;
  status?: string;
  command?: string;
  mode?: string;
  currentPhase?: string;
  cycle?: number;
  memoryMb?: number;
  uptimeSeconds?: number;
  lastHeartbeat?: Date | string;
  recentLogs?: string[];
} | null | undefined;

/**
 * Panelde gösterilecek motor durumu. Eskiden "panelden durdurulmadıysa
 * çevrimiçi" kabul ediliyordu; motor çökse ya da sunucu kapansa bile panel
 * "7/24 CANLI AKTİF" gösteriyordu. Artık taze kalp atışı şart.
 */
export function describeDaemon(heartbeat: HeartbeatLike, now = Date.now()): DaemonStatus {
  const stopped = heartbeat?.command === "stop" || heartbeat?.status === "stopped";
  const last = heartbeat?.lastHeartbeat ? new Date(heartbeat.lastHeartbeat) : null;
  const ageSec = last && !Number.isNaN(last.getTime()) ? Math.max(0, Math.round((now - last.getTime()) / 1000)) : null;
  const fresh = ageSec !== null && ageSec * 1000 < HEARTBEAT_STALE_MS;
  const isOnline = !stopped && fresh;

  const currentPhase = stopped
    ? "🛑 Durduruldu (Panelden 'Motoru Başlat' ile çalıştırılabilir)"
    : !fresh
    ? `⚠️ Motordan ${ageSec === null ? "hiç" : `${Math.round(ageSec / 60)} dakikadır`} sinyal gelmiyor`
    : heartbeat?.currentPhase || "Çalışıyor";

  const mode = heartbeat?.mode === "new_only" || heartbeat?.mode === "sweep_only" ? heartbeat.mode : "hybrid";
  const command = heartbeat?.command === "stop" || heartbeat?.command === "restart" ? heartbeat.command : stopped ? "stop" : "run";

  return {
    isOnline,
    heartbeatAgeSec: ageSec,
    host: heartbeat?.host || "bilinmiyor",
    currentPhase,
    cycle: heartbeat?.cycle || 0,
    memoryMb: isOnline ? heartbeat?.memoryMb ?? null : null,
    uptimeSeconds: isOnline ? heartbeat?.uptimeSeconds || 0 : 0,
    lastHeartbeat: last && ageSec !== null ? last.toISOString() : null,
    status: stopped ? "stopped" : isOnline ? (heartbeat?.status === "idle" ? "idle" : "online") : "offline",
    command,
    mode,
    recentLogs: heartbeat?.recentLogs || [],
  };
}
