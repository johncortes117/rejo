import { describe, expect, it } from "vitest";
import type { Settlement, Transaction } from "@/domain/models";
import { calculateCashFlowSummary, getCashFlowRange } from "@/features/economics/cash-flow";

const meta = { farmId: "farm-1", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", createdBy: "user-1" };

const settlement = (id: string, periodEnd: string, totalPaid: number, deletedAt?: string): Settlement => ({
  ...meta,
  id,
  buyerId: "buyer-1",
  periodStart: periodEnd,
  periodEnd,
  litersPaid: 100,
  pricePerLiterPaid: totalPaid / 100,
  totalPaid,
  reconciled: false,
  deletedAt
});

const transaction = (id: string, date: string, direction: Transaction["direction"], amount: number, deletedAt?: string): Transaction => ({
  ...meta,
  id,
  date,
  direction,
  category: "Test record",
  amount,
  isEstimated: false,
  deletedAt
});

describe("getCashFlowRange", () => {
  it("builds inclusive rolling business-date ranges", () => {
    expect(getCashFlowRange("2026-07-24", "three_days")).toMatchObject({ startDate: "2026-07-22", endDate: "2026-07-24", label: "Últimos 3 días" });
    expect(getCashFlowRange("2026-07-24", "week")).toMatchObject({ startDate: "2026-07-18", endDate: "2026-07-24" });
    expect(getCashFlowRange("2026-07-24", "month")).toMatchObject({ startDate: "2026-06-25", endDate: "2026-07-24" });
  });
});

describe("calculateCashFlowSummary", () => {
  it("combines milk settlements and income movements while excluding old and deleted records", () => {
    const range = getCashFlowRange("2026-07-24", "month");
    const result = calculateCashFlowSummary(
      [settlement("milk-payment", "2026-07-22", 540), settlement("old-payment", "2026-06-24", 320), settlement("deleted-payment", "2026-07-20", 80, "2026-07-23T00:00:00.000Z")],
      [transaction("animal-sale", "2026-07-21", "income", 170), transaction("feed", "2026-07-19", "expense", 250), transaction("medicine", "2026-07-18", "expense", 45.5), transaction("old-expense", "2026-06-24", "expense", 999), transaction("deleted-expense", "2026-07-23", "expense", 90, "2026-07-24T00:00:00.000Z")],
      range
    );

    expect(result).toEqual({ range, settlementIncome: 540, otherIncome: 170, totalIncome: 710, totalExpenses: 295.5, result: 414.5, activityCount: 4, status: "positive" });
  });

  it("reports an empty result when the selected period has no active cash activity", () => {
    const range = getCashFlowRange("2026-07-24", "three_days");
    expect(calculateCashFlowSummary([settlement("old-payment", "2026-07-20", 400)], [transaction("old-expense", "2026-07-20", "expense", 40)], range)).toMatchObject({ totalIncome: 0, totalExpenses: 0, result: 0, activityCount: 0, status: "empty" });
  });
});
