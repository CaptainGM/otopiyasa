import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeGoogleLoginTicket, issueGoogleLoginTicket } from "@/lib/google-ticket";

const model = vi.hoisted(() => ({
  create: vi.fn(),
  findOneAndUpdate: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ connectDB: async () => {} }));
vi.mock("@/models/GoogleLoginTicket", () => ({ GoogleLoginTicket: model }));

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

beforeEach(() => {
  model.create.mockReset();
  model.findOneAndUpdate.mockReset();
});

describe("issueGoogleLoginTicket", () => {
  it("ham kodu değil yalnızca özetini saklar ve kodu döner", async () => {
    model.create.mockResolvedValue({});
    const code = await issueGoogleLoginTicket("64b000000000000000000001");

    expect(code.length).toBeGreaterThanOrEqual(40);
    expect(model.create).toHaveBeenCalledTimes(1);
    const saved = model.create.mock.calls[0][0];
    expect(saved.codeHash).toBe(sha256(code));
    expect(saved).not.toHaveProperty("code");
    expect(saved.userId).toBe("64b000000000000000000001");
  });

  it("bilet 60 saniye sonra sona erer", async () => {
    model.create.mockResolvedValue({});
    const before = Date.now();
    await issueGoogleLoginTicket("64b000000000000000000001");
    const expiresAt = model.create.mock.calls[0][0].expiresAt as Date;
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(59_000);
    expect(expiresAt.getTime() - before).toBeLessThanOrEqual(61_000);
  });
});

describe("consumeGoogleLoginTicket", () => {
  it("geçerli kod kullanıcı kimliğini döner ve kaydı kullanılmış işaretler", async () => {
    model.findOneAndUpdate.mockReturnValue({
      lean: async () => ({ userId: "64b000000000000000000002" }),
    });
    const userId = await consumeGoogleLoginTicket("ornek-kod");

    expect(userId).toBe("64b000000000000000000002");
    const [filter, update] = model.findOneAndUpdate.mock.calls[0];
    expect(filter.codeHash).toBe(sha256("ornek-kod"));
    expect(filter.usedAt).toBeNull();
    expect(filter.expiresAt.$gt).toBeInstanceOf(Date);
    expect(update.$set.usedAt).toBeInstanceOf(Date);
  });

  it("kullanılmış, yanlış ya da süresi dolmuş kod null döner", async () => {
    model.findOneAndUpdate.mockReturnValue({ lean: async () => null });
    expect(await consumeGoogleLoginTicket("harcanmis-kod")).toBeNull();
  });

  it("boş ya da aşırı uzun kod veritabanına gitmeden reddedilir", async () => {
    expect(await consumeGoogleLoginTicket("")).toBeNull();
    expect(await consumeGoogleLoginTicket("x".repeat(129))).toBeNull();
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
