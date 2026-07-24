import { describe, expect, it } from "vitest";
import { toBusinessDate, toBusinessTime } from "@/domain/time";

describe("farm timezone", () => {
  it("keeps a dawn milking on the correct Guayaquil business date", () => {
    const dawn = new Date("2026-07-24T04:00:00-05:00");

    expect(toBusinessDate(dawn)).toBe("2026-07-24");
    expect(toBusinessTime(dawn)).toBe("04:00");
  });

  it("uses the Guayaquil calendar instead of UTC around midnight", () => {
    const evening = new Date("2026-07-25T02:30:00Z");

    expect(toBusinessDate(evening)).toBe("2026-07-24");
    expect(toBusinessTime(evening)).toBe("21:30");
  });
});
