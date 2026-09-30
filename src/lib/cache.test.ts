import { describe, expect, it } from "vitest";
import { cached, invalidateCache } from "./cache";

describe("cached", () => {
  it("aynı anahtar için fn'i bir kez çağırır (TTL içinde)", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return calls;
    };
    const a = await cached("t:1", 1000, fn);
    const b = await cached("t:1", 1000, fn);
    expect(a).toBe(1);
    expect(b).toBe(1); 
    expect(calls).toBe(1);
  });


  it("TTL dolunca eski değeri anında döndürüp arka planda tazeler", async () => {
    let calls = 0;
    const fn = async () => ++calls;

    expect(await cached("t:2", 1, fn)).toBe(1);
    await new Promise((r) => setTimeout(r, 5));

 
    expect(await cached("t:2", 1, fn)).toBe(1);
    expect(calls).toBe(2);

   
    await new Promise((r) => setTimeout(r, 10));
    expect(await cached("t:2", 60_000, fn)).toBe(2);
  });

  it("aynı anda tek bir arka plan tazelemesi başlatır", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return calls;
    };
    await cached("t:swr", 1, fn);
    await new Promise((r) => setTimeout(r, 5));

  
    await Promise.all([cached("t:swr", 1, fn), cached("t:swr", 1, fn), cached("t:swr", 1, fn)]);
    expect(calls).toBe(2);
  });

  it("invalidateCache önekle temizler", async () => {
    let calls = 0;
    const fn = async () => ++calls;
    await cached("home:x", 10_000, fn);
    invalidateCache("home:");
    await cached("home:x", 10_000, fn);
    expect(calls).toBe(2);
  });

  it("fn hata verirse önbelleğe yazmaz", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new Error("boom");
    };
    await expect(cached("t:3", 10_000, fn)).rejects.toThrow();
    await expect(cached("t:3", 10_000, fn)).rejects.toThrow();
    expect(calls).toBe(2); 
  });


  it("giriş sayısı sınırı aşınca en eski kayıtları düşürür", async () => {
    invalidateCache();
    for (let i = 0; i < 700; i++) {
      await cached(`bulk:${i}`, 60_000, async () => i);
    }

    let recomputed = false;

    await cached("bulk:0", 60_000, async () => {
      recomputed = true;
      return -1;
    });
    expect(recomputed).toBe(true);

    
    let touched = false;
    const last = await cached("bulk:699", 60_000, async () => {
      touched = true;
      return -1;
    });
    expect(touched).toBe(false);
    expect(last).toBe(699);
    invalidateCache();
  });
});
