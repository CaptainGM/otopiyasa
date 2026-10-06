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

describe("IBAN, havale ve harici bağlantı kalıpları", () => {
  it("IBAN numarasını (boşluklu) yakalar", () => {
    expect(assessMessageRisk("Hesabım TR12 3456 7890 1234 5678 9012 34 kapora at")).toContain("payment-info");
    expect(assessMessageRisk("TR330006100519786457841326 buna gönder")).toContain("payment-info");
  });

  it("havale/EFT/Papara kelimelerini yakalar", () => {
    expect(assessMessageRisk("havale ile gönderirsen ayırırım")).toContain("payment-info");
    expect(assessMessageRisk("Paparaya atabilir misin")).toContain("payment-info");
    expect(assessMessageRisk("iban atar mısın")).toContain("payment-info");
  });

  it("harici bağlantıları yakalar", () => {
    expect(assessMessageRisk("Şuradan öde https://guvenli-odeme.xyz/abc")).toContain("external-link");
    expect(assessMessageRisk("www.araba-satis.com adresine bak")).toContain("external-link");
    expect(assessMessageRisk("guvenliodeme.shop")).toContain("external-link");
  });

  it("normal konuşmayı ve tarihleri işaretlemez", () => {
    expect(assessMessageRisk("Yarın saat 15.30'da ofisinizde görüşelim, km 85.000 doğru mu?")).toEqual([]);
    expect(assessMessageRisk("Cumartesi eksper raporuyla görebilir miyim?")).toEqual([]);
  });
});
