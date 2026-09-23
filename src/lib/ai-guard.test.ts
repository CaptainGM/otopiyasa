import { describe, it, expect } from "vitest";
import {
  isJunkMessage,
  AI_LIMITS,
  consumeAiBudget,
  aiBudgetStatus,
  resetAiBudget,
} from "./ai-guard";

describe("isJunkMessage", () => {
  it("gerçek Türkçe soruları ASLA elemez", () => {
    
    const real = [
      "en ucuz bmw hangisi",
      "1 milyon altı dizel araba öner",
      "2020 sonrası otomatik vitesli araç arıyorum",
      "bu araç hasarlıysa fiyatı düşer mi",
      "merhaba",
      "teşekkürler",
      "selam nasılsın",
      "audiye götür beni",
      "320i ilanlarına yönlendirir misin",
      "İstanbul'da 500 bin TL'ye ne alabilirim",
      "ok",
      "evet",
      "peki onun 2020 modeli?",
      "Şahin mi Doğan mı daha ekonomik",
    ];
    for (const m of real) {
      expect(isJunkMessage(m), `"${m}" çöp sayılmamalı`).toBe(false);
    }
  });

  it("boş / tek karakterli girdiyi eler", () => {
    expect(isJunkMessage("")).toBe(true);
    expect(isJunkMessage("   ")).toBe(true);
    expect(isJunkMessage("a")).toBe(true);
  });

  it("hiç harf içermeyen girdiyi eler", () => {
    expect(isJunkMessage("!!!!")).toBe(true);
    expect(isJunkMessage("12345")).toBe(true);
    expect(isJunkMessage("...???...")).toBe(true);
  });

  it("aynı karakterin uzun tekrarını eler", () => {
    expect(isJunkMessage("aaaaaaaaaa")).toBe(true);
    expect(isJunkMessage("???????????")).toBe(true);
 
    expect(isJunkMessage("çoook güzel araba")).toBe(false);
  });

  it("boşluksuz devasa bloğu eler (kota yakma girişimi)", () => {
    expect(isJunkMessage("x".repeat(50))).toBe(true);
    expect(isJunkMessage("abcdefghij".repeat(5))).toBe(true);
  });

  it("sesli harf içermeyen klavye ezmesini eler", () => {
    expect(isJunkMessage("sdfghjklzxcvbnm")).toBe(true);
    expect(isJunkMessage("qwrtypsdfghjklzxcvbnm")).toBe(true);
  });

  it("sesli oranı kısa girdilerde uygulanmaz (yanlış pozitif olmasın)", () => {
    
    expect(isJunkMessage("bmw mi")).toBe(false);
  });

  
  it("kısa hecenin tekrarını eler (asdasdasd, hahahaha)", () => {
    expect(isJunkMessage("asdasdasdasd")).toBe(true);
    expect(isJunkMessage("hahahaha")).toBe(true);
    expect(isJunkMessage("zxzxzxzx")).toBe(true);
    expect(isJunkMessage("abcabcabc")).toBe(true);
  });

  it("iki kez tekrar eden gerçek kelimeleri elemez", () => {
   
    expect(isJunkMessage("mama")).toBe(false);
    expect(isJunkMessage("gaga")).toBe(false);
    expect(isJunkMessage("araba araba")).toBe(false);
  });
});

describe("günlük AI bütçesi", () => {
  it("sınıra kadar izin verir, sonra reddeder", () => {
    resetAiBudget();
    const { limit } = aiBudgetStatus();
    for (let i = 0; i < limit; i++) {
      expect(consumeAiBudget(), `${i}. çağrı geçmeliydi`).toBe(true);
    }
  
    expect(consumeAiBudget()).toBe(false);
    expect(aiBudgetStatus().used).toBe(limit);
    resetAiBudget();
  });

  it("sıfırlandıktan sonra yeniden izin verir", () => {
    resetAiBudget();
    expect(consumeAiBudget()).toBe(true);
    expect(aiBudgetStatus().used).toBe(1);
    resetAiBudget();
    expect(aiBudgetStatus().used).toBe(0);
  });
});

describe("AI_LIMITS", () => {
  it("pahalı uç nokta en dar limite sahip", () => {
    
    expect(AI_LIMITS.photo.limit).toBeLessThan(AI_LIMITS.chat.limit);
    expect(AI_LIMITS.compare.limit).toBeLessThan(AI_LIMITS.chat.limit);
  });

  it("tüm limitler pozitif ve pencereli", () => {
    for (const [name, cfg] of Object.entries(AI_LIMITS)) {
      expect(cfg.limit, name).toBeGreaterThan(0);
      expect(cfg.windowMs, name).toBeGreaterThan(0);
    }
  });
});
