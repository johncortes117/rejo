import { describe, expect, it } from "vitest";
import { createUuidV7 } from "@/domain/ids";

describe("createUuidV7", () => {
  it("creates a PostgreSQL-compatible UUID", () => {
    const identifier = createUuidV7(new Date("2026-07-25T18:44:00.000Z").getTime());

    expect(identifier).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(identifier).toHaveLength(36);
  });
});
