import { describe, expect, it } from "vitest";
import { buildHerdIndicators, summarizeMilkControl } from "@/features/milk-control/milk-control";
import type { MilkControlRecord, MilkControlSession } from "@/domain/models";

const meta = { farmId: "farm", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", createdBy: "user" };
const session = (id: string, date: string): MilkControlSession => ({ id, ...meta, date });
const record = (id: string, sessionId: string, animalId: string, liters: number): MilkControlRecord => ({ id, ...meta, sessionId, animalId, liters });

describe("summarizeMilkControl", () => {
  it("groups the latest control and compares it with the prior monthly control", () => {
    const summary = summarizeMilkControl([session("old", "2026-06-01"), session("new", "2026-07-01")], [record("one", "old", "a", 10), record("two", "new", "a", 8), record("three", "new", "b", 10), record("four", "new", "c", 14)]);
    expect(summary).toMatchObject({ totalLiters: 32, averageLiters: 10.67, priorTotalLiters: 10, trend: "up" });
    expect(summary.bands).toMatchObject({ a: "low", b: "medium", c: "high" });
  });

  it("keeps indicators explicit when there is not enough reproductive data", () => {
    const indicators = buildHerdIndicators({ animals: [], sessions: [], records: [], healthEvents: [], services: [], pregnancyChecks: [], date: "2026-07-24" });
    expect(indicators.servicesPerConfirmedPregnancy).toBeUndefined();
    expect(indicators.milk.session).toBeUndefined();
  });
});
