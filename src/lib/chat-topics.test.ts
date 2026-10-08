import { describe, expect, it } from "vitest";
import { topicLinkFor } from "./chat-topics";

describe("topicLinkFor", () => {
  it("ilan verme sorusunu ilan ver sayfasına yönlendirir", () => {
    expect(topicLinkFor("nasıl ilan veririm")?.href).toBe("/sell");
    expect(topicLinkFor("Aracımı satmak istiyorum, aracımı sat")?.href).toBe("/sell");
  });

  it("kendi ilanını düzenleme sorusu ilanlarım sayfasına gider", () => {
    expect(topicLinkFor("ilanımı nasıl düzenlerim")?.href).toBe("/listings");
  });

  it("favori, karşılaştırma, değer kaybı, tahmin, harita sorularını yönlendirir", () => {
    expect(topicLinkFor("favorilerim nerede")?.href).toBe("/favorites");
    expect(topicLinkFor("iki aracı karşılaştırmak istiyorum")?.href).toBe("/compare");
    expect(topicLinkFor("bu model yılda ne kadar değer kaybeder, değer kaybı")?.href).toBe("/deger-kaybi");
    expect(topicLinkFor("aracımın fiyat tahmini")?.href).toBe("/predict");
    expect(topicLinkFor("haritada ilanlar nerede")?.href).toBe("/map");
  });

  it("araç aramalarına yönlendirme eklemez", () => {
    expect(topicLinkFor("en ucuz bmw")).toBeNull();
    expect(topicLinkFor("1 milyon altı dizel araba öner")).toBeNull();
  });
});
