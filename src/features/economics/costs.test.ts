import { describe, expect, it } from "vitest";
import { calculateCostSummary } from "@/features/economics/costs";

const meta = { farmId: "farm-1", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", createdBy: "user-1" };

describe("calculateCostSummary", () => {
  it("keeps cash, depreciation, and family labor as distinct cost per liter views", () => {
    const result = calculateCostSummary([{ ...meta, id: "expense", date: "2026-07-24", direction: "expense", category: "Molido", amount: 100, isEstimated: false }], [{ ...meta, id: "asset", name: "Tanque", category: "Equipo", purchaseDate: "2026-01-01", purchaseValue: 1200, usefulLifeYears: 10, salvageValue: 0 }], [{ ...meta, id: "labor", workerName: "Familia", type: "family", rate: 20, daysWorked: 5, period: "2026-07" }], 1000);
    expect(result).toEqual({ cashCost: 100, depreciationCost: 10, familyLaborCost: 100, productionLiters: 1000, cashPerLiter: 0.1, withDepreciationPerLiter: 0.11, fullPerLiter: 0.21 });
  });
});
