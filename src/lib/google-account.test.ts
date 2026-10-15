import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalEmail } from "@/lib/email-policy";
import { findOrLinkGoogleUser, GoogleAccountConflictError } from "@/lib/google-account";

type Row = Record<string, unknown> & { save: ReturnType<typeof vi.fn> };

// Veritabanı yerine bellek içi kullanıcı listesi: yalnızca bağlama kararlarını sınar.
const db = vi.hoisted(() => ({
  rows: [] as Row[],
}));

vi.mock("@/models/User", () => {
  type MockRow = Record<string, unknown> & { save: ReturnType<typeof vi.fn> };
  const matches = (row: MockRow, clause: Record<string, unknown>) =>
    Object.entries(clause).every(([key, value]) => row[key] === value);
  const wrap = (fields: Record<string, unknown>) => {
    const row: MockRow = {
      _id: `id-${db.rows.length + 1}`,
      ...fields,
      save: vi.fn(async () => row),
    };
    return row;
  };
  return {
    User: {
      findOne: async (query: Record<string, unknown>) => {
        const clauses = (query.$or as Record<string, unknown>[] | undefined) ?? [query];
        return db.rows.find((row) => clauses.some((clause) => matches(row, clause))) ?? null;
      },
      create: async (fields: Record<string, unknown>) => {
        const row = wrap(fields);
        db.rows.push(row);
        return row;
      },
    },
  };
});

function addRow(fields: Record<string, unknown>): Row {
  const row: Row = { _id: `id-${db.rows.length + 1}`, ...fields, save: vi.fn(async () => row) };
  db.rows.push(row);
  return row;
}

const profile = { sub: "google-sub-1", email: "Ada@Example.com", name: "Ada Lovelace" };

beforeEach(() => {
  db.rows = [];
});

describe("findOrLinkGoogleUser", () => {
  it("Google kimliği zaten bağlıysa o hesabı döner", async () => {
    const existing = addRow({ email: "ada@example.com", googleSub: "google-sub-1", passwordHash: null });
    expect(await findOrLinkGoogleUser(profile)).toBe(existing);
    expect(db.rows).toHaveLength(1);
  });

  it("yeni kullanıcıyı şifresiz ve doğrulanmış olarak açar", async () => {
    const user = await findOrLinkGoogleUser(profile);
    expect(user).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      canonicalEmail: canonicalEmail("ada@example.com"),
      googleSub: "google-sub-1",
      passwordHash: null,
      emailVerified: true,
    });
  });

  it("doğrulanmamış mevcut hesabı bağlar ve eski şifresini siler", async () => {
    const existing = addRow({
      email: "ada@example.com",
      passwordHash: "eski-hash",
      emailVerified: false,
      verifyTokenHash: "dogrulama",
      verifyTokenExpires: new Date(),
    });
    const user = await findOrLinkGoogleUser(profile);
    expect(user).toBe(existing);
    expect(user).toMatchObject({
      googleSub: "google-sub-1",
      passwordHash: null,
      emailVerified: true,
      verifyTokenHash: null,
      verifyTokenExpires: null,
    });
    expect(existing.save).toHaveBeenCalledTimes(1);
  });

  it("doğrulanmış şifreli hesabı bağlar; şifre korunur", async () => {
    const existing = addRow({ email: "ada@example.com", passwordHash: "hash", emailVerified: true });
    await findOrLinkGoogleUser(profile);
    expect(existing).toMatchObject({ googleSub: "google-sub-1", passwordHash: "hash", emailVerified: true });
  });

  it("Gmail'de nokta farklı aynı kutu aynı hesaba bağlanır", async () => {
    const existing = addRow({
      email: "ad.a@gmail.com",
      canonicalEmail: canonicalEmail("ad.a@gmail.com"),
      passwordHash: "hash",
      emailVerified: true,
    });
    const user = await findOrLinkGoogleUser({ sub: "google-sub-2", email: "ada@gmail.com", name: "" });
    expect(user).toBe(existing);
    expect(existing.googleSub).toBe("google-sub-2");
  });

  it("e-posta başka bir Google hesabına bağlıysa bağlamaz", async () => {
    addRow({ email: "ada@example.com", googleSub: "baska-google", passwordHash: "hash", emailVerified: true });
    await expect(findOrLinkGoogleUser(profile)).rejects.toBeInstanceOf(GoogleAccountConflictError);
  });
});
