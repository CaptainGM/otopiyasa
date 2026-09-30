import { describe, it, expect } from "vitest";
import { checkListingText, checkPublicText, containsProfanity } from "./content-filter";

describe("containsProfanity", () => {
  it("açık küfür ve hakareti yakalar", () => {
    for (const text of [
      "amk bu ne biçim araba",
      "Siktir git",
      "orospu çocuğu",
      "senin gibi pezevenk",
      "gerizekalı satıcı",
      "Ulan ibne",
      "AQ",
      "fuck this car",
    ]) {
      expect(containsProfanity(text), text).toBe(true);
    }
  });

  it("büyük/küçük harf, Türkçe karakter ve uzatma ile gizlemeyi yakalar", () => {
    for (const text of ["SİKTİR", "oROSPU", "amkkkkk", "orospuuuu", "yarrrak"]) {
      expect(containsProfanity(text), text).toBe(true);
    }
  });

  it("rakam/noktalama/boşlukla gizlemeyi yakalar", () => {
    for (const text of ["s1kt1r", "0rospu", "a m k", "s.i.k.t.i.r", "o r o s p u", "p3zevenk"]) {
      expect(containsProfanity(text), text).toBe(true);
    }
  });

  it("normal araç ilanı metinlerini engellemez (yanlış pozitif yok)", () => {
    for (const text of [
      "Sıkıntısız, hasarsız, boyasız 2019 Volkswagen Passat. Sıkışık trafikte bile rahat.",
      "Amasya'da sahibinden, şikayet yok, servis bakımlı",
      "Samsun Gaziantep Mersin Kocaeli Osmaniye Hakkari",
      "Tofaş Şahin 1.6 dizel, 150 hp, 2020 model, 45.000 km",
      "Pazarlık payı vardır, takas yapılır, kış lastiği hediye",
      "Sıfır ayarında, garantili, ilk sahibinden, ekspertizli",
      "Mazda CX-5 2.0 Skyactiv, Pasat B8, Opel Astra",
      "Sık kullanılan bir araç değil, garajda durdu",
      "Hatchback 5 kapı, otomatik vites, klima, ABS, ESP",
      "",
    ]) {
      expect(containsProfanity(text), text).toBe(false);
    }
  });

  it("rakam ve birimler içeren metinleri bozmaz", () => {
    expect(containsProfanity("1.6 TSI 150hp 2018 model 120.000 km 750.000 TL")).toBe(false);
    expect(containsProfanity("34 ABC 123 plaka İstanbul")).toBe(false);
  });
});

describe("checkListingText", () => {
  it("temiz ilanı geçirir", () => {
    expect(checkListingText(["Renault", "Clio", "İstanbul", "Hasarsız, düzenli bakımlı."]).ok).toBe(true);
  });

  it("marka/model gibi serbest metin alanlarındaki küfürü de yakalar", () => {
    const v = checkListingText(["Amk", "Model", "İstanbul", ""]);
    expect(v.ok).toBe(false);
    expect(v.category).toBe("profanity");
  });

  it("kapora, ön ödeme ve IBAN isteyen açıklamayı reddeder", () => {
    for (const text of [
      "Görmeden kapora gönderin",
      "Önden ödeme gerekir",
      "IBAN: TR12 3456 0000",
      "western union ile ödeme",
    ]) {
      const v = checkListingText([text]);
      expect(v.ok, text).toBe(false);
      expect(v.category, text).toBe("scam");
    }
  });

  it("dış bağlantı ve mesajlaşma yönlendirmesini reddeder", () => {
    for (const text of [
      "Detaylar için https://site.example/arac",
      "www.ornek.com adresine bakın",
      "WhatsApp'tan yazın",
      "telegram: @satici",
      "instagram hesabımdan bakabilirsiniz",
      "ornek.com/ilan",
    ]) {
      const v = checkListingText([text]);
      expect(v.ok, text).toBe(false);
      expect(v.category, text).toBe("link");
    }
  });

  it("araç açıklamasındaki normal ifadeleri link sanmaz", () => {
    for (const text of [
      "Araç 2.0 TDI, 1.6 motor, km 85.000. Servis kayıtları mevcut.",
      "Boya yok, değişen yok. Tramer kaydı 0 TL.",
      "Tavan camı, deri döşeme, ısıtmalı koltuk.",
    ]) {
      expect(checkListingText([text]).ok, text).toBe(true);
    }
  });
});

describe("checkPublicText", () => {
  it("soru/yorum/mesajlarda yalnızca küfrü engeller (kapora uyarısı ayrı sistemde)", () => {
    expect(checkPublicText("Araç hâlâ satılık mı?").ok).toBe(true);
    expect(checkPublicText("Whatsapp numaranızı alabilir miyim?").ok).toBe(true);
    const v = checkPublicText("aptal mısın");
    expect(v.ok).toBe(false);
    expect(v.category).toBe("profanity");
  });
});
