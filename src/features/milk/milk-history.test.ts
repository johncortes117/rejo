import { describe, expect, it } from "vitest";
import type { MilkUsage, TankReading } from "@/domain/models";
import { buildMilkHistory } from "@/features/milk/milk-history";

const metadata = { farmId: "farm", createdAt: "2026-07-01T12:00:00.000Z", updatedAt: "2026-07-01T12:00:00.000Z", createdBy: "user" };
const reading = (id: string, date: string, liters: number, readBy: TankReading["readBy"], updatedAt = metadata.updatedAt): TankReading => ({ ...metadata, id, date, liters, readBy, moment: "at_pickup", time: "17:00", updatedAt });
const calfUse = (id: string, date: string, liters: number): MilkUsage => ({ ...metadata, id, date, liters, type: "calves" });

describe("buildMilkHistory", () => {
  it("keeps the latest active measurement per day and shows its related figures", () => {
    const history = buildMilkHistory([
      reading("older", "2026-07-20", 190, "farm"),
      reading("newer", "2026-07-20", 195, "farm", "2026-07-20T18:00:00.000Z"),
      reading("buyer", "2026-07-20", 193, "buyer"),
      reading("latest-day", "2026-07-21", 200, "farm")
    ], [calfUse("calves-one", "2026-07-20", 3), calfUse("calves-two", "2026-07-20", 1)]);

    expect(history).toEqual([
      { date: "2026-07-21", liters: 200 },
      { date: "2026-07-20", liters: 195, buyerLiters: 193, calvesLiters: 4 }
    ]);
  });
});
