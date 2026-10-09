import { describe, expect, it } from "vitest";

describe("vitest harness", () => {
  it("resolves the ~~ alias", async () => {
    const mod = await import("~~/utils/mabrur/names");
    expect(mod).toBeTypeOf("object");
  });
});
