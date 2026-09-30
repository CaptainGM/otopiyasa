import { describe, it, expect } from "vitest";
import { describeDaemon } from "./daemon-status";

const now = new Date("2026-09-30T12:00:00Z").getTime();

describe("describeDaemon", () => {
  it("taze kalp atışında çevrimiçi sayar", () => {
    const s = describeDaemon({ status: "online", lastHeartbeat: new Date(now - 20_000), currentPhase: "Tarıyor", memoryMb: 150 }, now);
    expect(s.isOnline).toBe(true);
    expect(s.status).toBe("online");
    expect(s.currentPhase).toBe("Tarıyor");
    expect(s.memoryMb).toBe(150);
  });

  it("kalp atışı eskiyse panelden durdurulmamış olsa bile çevrimdışı sayar", () => {
    // Eski panel bu durumda "7/24 CANLI AKTİF" gösteriyordu.
    const s = describeDaemon({ status: "online", command: "run", lastHeartbeat: new Date(now - 45 * 60_000) }, now);
    expect(s.isOnline).toBe(false);
    expect(s.status).toBe("offline");
    expect(s.currentPhase).toContain("45 dakikadır sinyal gelmiyor");
    expect(s.memoryMb).toBeNull();
  });

  it("panelden durdurulduysa taze olsa bile durdu der", () => {
    const s = describeDaemon({ command: "stop", lastHeartbeat: new Date(now - 5_000) }, now);
    expect(s.isOnline).toBe(false);
    expect(s.status).toBe("stopped");
  });

  it("hiç kalp atışı yoksa uydurma değer döndürmez", () => {
    const s = describeDaemon(null, now);
    expect(s.isOnline).toBe(false);
    expect(s.lastHeartbeat).toBeNull();
    expect(s.host).toBe("bilinmiyor");
    expect(s.cycle).toBe(0);
  });
});
