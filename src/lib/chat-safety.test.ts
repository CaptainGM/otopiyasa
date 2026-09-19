import { describe, it, expect } from "vitest";
import { assessMessageRisk } from "./chat-safety";

describe("assessMessageRisk", () => {
  it("normal mesajda hiçbir bayrak yok", () => {
    expect(assessMessageRisk("Araç hâlâ satılık mı, ne zaman görebiliriz?")).toEqual([]);
  });

  it("WhatsApp'a yönlendirmeyi yakalar", () => {
    expect(assessMessageRisk("Whatsapp'tan devam edelim mi")).toContain("off-platform");
  });

  it("Telegram'ı yakalar", () => {
    expect(assessMessageRisk("telegram üzerinden yazışalım")).toContain("off-platform");
  });

  it("kapora talebini yakalar", () => {
    expect(assessMessageRisk("Aracı ayırmak için kapora gönderir misin")).toContain("prepayment");
  });

  it("peşinat (aksansız) talebini yakalar", () => {
    expect(assessMessageRisk("once pesinat atman lazim")).toContain("prepayment");
  });

  it("her iki tür de aynı mesajda bulunabilir", () => {
    const flags = assessMessageRisk("Whatsapptan yazışalım, önce kapora at");
    expect(flags).toContain("off-platform");
    expect(flags).toContain("prepayment");
  });

  it("boş metinde çökmez", () => {
    expect(assessMessageRisk("")).toEqual([]);
  });
});
