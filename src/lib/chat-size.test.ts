import { describe, expect, it } from "vitest";
import {
  availableChatSize,
  clampChatSize,
  DEFAULT_CHAT_SIZE,
  MAX_CHAT_WIDTH,
  MIN_CHAT_SIZE,
} from "./chat-size";


function fits(size: { w: number; h: number }, vw: number, vh: number) {
  const available = availableChatSize(vw, vh);
  return size.w <= available.w && size.h <= available.h;
}

const SCREENS: Array<[number, number, string]> = [
  [1920, 1080, "masaüstü"],
  [1600, 900, "geniş laptop"],
  [1440, 900, "MacBook"],
  [1366, 768, "yaygın laptop"],
  [1280, 720, "küçük laptop"],
  [1280, 600, "kısaltılmış pencere"],
  [800, 600, "çok küçük pencere"],
];

describe("clampChatSize", () => {
  it.each(SCREENS)("varsayılan boyut %ix%i (%s) ekranına sığar", (vw, vh) => {
    const size = clampChatSize(
      DEFAULT_CHAT_SIZE.w,
      DEFAULT_CHAT_SIZE.h,
      availableChatSize(vw, vh)
    );
    expect(fits(size, vw, vh)).toBe(true);
  });

  it.each(SCREENS)(
    "büyük ekranda kaydedilmiş devasa boyut %ix%i (%s) ekranına sığdırılır",
    (vw, vh) => {
  
      const size = clampChatSize(2000, 3000, availableChatSize(vw, vh));
      expect(fits(size, vw, vh)).toBe(true);
    }
  );

  it("asgari boyutun altına inmez", () => {
    const size = clampChatSize(10, 10, availableChatSize(1920, 1080));
    expect(size.w).toBe(MIN_CHAT_SIZE.w);
    expect(size.h).toBe(MIN_CHAT_SIZE.h);
  });

  it("okunabilirlik için genişlik üst sınırı uygulanır", () => {
    const size = clampChatSize(5000, 500, availableChatSize(3840, 2160));
    expect(size.w).toBe(MAX_CHAT_WIDTH);
  });

  it("makul bir boyutu değiştirmez", () => {
    const size = clampChatSize(400, 560, availableChatSize(1920, 1080));
    expect(size).toEqual({ w: 400, h: 560 });
  });
});

describe("availableChatSize", () => {
  it("kenar paylarını düşer", () => {
    const a = availableChatSize(1000, 800);
    expect(a.w).toBe(960); 
    expect(a.h).toBe(696); 
  });

  it("aşırı küçük ekranda asgari boyutun altına düşmez", () => {
    const a = availableChatSize(100, 100);
    expect(a.w).toBe(MIN_CHAT_SIZE.w);
    expect(a.h).toBe(MIN_CHAT_SIZE.h);
  });
});
