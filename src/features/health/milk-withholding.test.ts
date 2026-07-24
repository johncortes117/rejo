import { describe, expect, it } from "vitest";
import type { HealthEvent } from "@/domain/models";
import { computeMilkWithholdingUntil, isMilkWithheld } from "@/features/health/milk-withholding";

const event = (date: string, hours: number): HealthEvent => ({
  id: `${date}-${hours}`,
  farmId: "farm-1",
  animalId: "animal-1",
  date,
  type: "mastitis",
  milkWithdrawalHours: hours,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  createdBy: "user-1"
});

describe("milk withholding", () => {
  it("keeps the latest deadline when treatments overlap", () => {
    const events = [event("2026-07-01", 96), event("2026-07-03", 72)];
    expect(computeMilkWithholdingUntil(events)).toBe("2026-07-06T05:00:00.000Z");
    expect(isMilkWithheld(events, new Date("2026-07-05T12:00:00.000Z"))).toBe(true);
    expect(isMilkWithheld(events, new Date("2026-07-06T06:00:00.000Z"))).toBe(false);
  });
});
