import { describe, expect, it } from "vitest";
import { readJson } from "./http";

const req = (body: string) => new Request("http://localhost/api", { method: "POST", body, headers: { "Content-Type": "application/json" } });

describe("readJson", () => {
  it("bozuk JSON'da boş nesne döner (500 yerine 400 üretilebilsin)", async () => {
    expect(await readJson(req("not json"))).toEqual({});
    expect(await readJson(req(""))).toEqual({});
  });

  it("nesne olmayan gövdede boş nesne döner", async () => {
    expect(await readJson(req("[1,2]"))).toEqual({});
    expect(await readJson(req("null"))).toEqual({});
    expect(await readJson(req('"x"'))).toEqual({});
  });

  it("normal modda iç içe değerleri korur", async () => {
    expect(await readJson(req('{"ids":["a","b"],"n":{"x":1}}'))).toEqual({ ids: ["a", "b"], n: { x: 1 } });
  });

  it("düz modda nesne/dizi/null değerleri boş metne, sayıları metne çevirir", async () => {
    const body = await readJson(req('{"email":{"$ne":null},"password":["x"],"code":123456,"ok":true,"nothing":null}'), { flat: true });
    expect(body).toEqual({ email: "", password: "", code: "123456", ok: true, nothing: "" });
  });
});
