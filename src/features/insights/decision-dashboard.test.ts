import { describe, expect, it } from "vitest";
import { buildDecisionDashboard } from "@/features/insights/decision-dashboard";

const metadata = { farmId: "farm-1", createdAt: "2026-07-01T12:00:00.000Z", updatedAt: "2026-07-01T12:00:00.000Z", createdBy: "user-1" };

describe("buildDecisionDashboard", () => {
  it("prioritizes a milk-withholding alert and an overdue preventive task", () => {
    const dashboard = buildDecisionDashboard({
      businessDate: "2026-07-24",
      now: new Date("2026-07-24T12:00:00-05:00"),
      animals: [{ ...metadata, id: "animal-1", name: "Pintada", sex: "female", birthDateEstimated: false, status: "active" }],
      healthEvents: [{ ...metadata, id: "event-1", animalId: "animal-1", date: "2026-07-23", type: "mastitis", milkWithdrawalHours: 96 }],
      healthPlanTasks: [{ ...metadata, id: "task-1", animalId: "animal-1", dueDate: "2026-07-22", taskType: "deworming", isTemplate: false }],
      heats: [], services: [], pregnancyChecks: [], calvings: [], tankReadings: []
    });

    expect(dashboard.alerts).toMatchObject([
      { tone: "critical", title: "Pintada: no se puede entregar su leche" },
      { tone: "attention", title: "Curada: Pintada" }
    ]);
  });

  it("returns a local trend and flags a meaningful downward change", () => {
    const tankReadings = [
      ["2026-07-19", 220], ["2026-07-20", 218], ["2026-07-21", 219], ["2026-07-22", 190], ["2026-07-23", 188], ["2026-07-24", 187]
    ].map(([date, liters], index) => ({ ...metadata, id: `reading-${index}`, date: date as string, liters: liters as number, time: "12:00", moment: "at_pickup" as const, readBy: "farm" as const }));
    const dashboard = buildDecisionDashboard({ businessDate: "2026-07-24", now: new Date("2026-07-24T12:00:00-05:00"), animals: [], healthEvents: [], healthPlanTasks: [], heats: [], services: [], pregnancyChecks: [], calvings: [], tankReadings });

    expect(dashboard.trend).toHaveLength(6);
    expect(dashboard.sevenDayAverage).toBe(203.7);
    expect(dashboard.trendDirection).toBe("down");
  });
});
