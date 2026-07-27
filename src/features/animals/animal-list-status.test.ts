import { describe, expect, it } from "vitest";
import type { Animal, Calving, HealthEvent, Heat, MilkControlRecord, MilkControlSession, PregnancyCheck, Service } from "@/domain/models";
import { buildAnimalListStatuses } from "@/features/animals/animal-list-status";

const metadata = { farmId: "farm", createdAt: "2026-07-01T12:00:00.000Z", updatedAt: "2026-07-01T12:00:00.000Z", createdBy: "user" };
const animal: Animal = { ...metadata, id: "bella", name: "Bella", sex: "female", birthDateEstimated: false, status: "active" };
const emptyFacts = { healthEvents: [] as HealthEvent[], heats: [] as Heat[], services: [] as Service[], pregnancyChecks: [] as PregnancyCheck[], calvings: [] as Calving[], milkControlSessions: [] as MilkControlSession[], milkControlRecords: [] as MilkControlRecord[] };

describe("buildAnimalListStatuses", () => {
  it("prioritizes milk withholding and reproductive attention over repeated profile facts", () => {
    const statuses = buildAnimalListStatuses({
      animal,
      asOf: "2026-07-27",
      now: new Date("2026-07-27T12:00:00-05:00"),
      ...emptyFacts,
      healthEvents: [{ ...metadata, id: "treatment", animalId: animal.id, date: "2026-07-27", type: "mastitis", milkWithdrawalHours: 24 }],
      heats: [{ ...metadata, id: "heat", animalId: animal.id, date: "2026-07-27", served: false }]
    });

    expect(statuses).toEqual([
      { label: "No entregar leche", tone: "critical" },
      { label: "En celo", tone: "attention" }
    ]);
  });

  it("shows the latest individual milk control when there is no urgent animal state", () => {
    const statuses = buildAnimalListStatuses({
      animal,
      asOf: "2026-07-27",
      now: new Date("2026-07-27T12:00:00-05:00"),
      ...emptyFacts,
      milkControlSessions: [{ ...metadata, id: "old", date: "2026-06-01" }, { ...metadata, id: "latest", date: "2026-07-20" }],
      milkControlRecords: [{ ...metadata, id: "old-reading", sessionId: "old", animalId: animal.id, liters: 8 }, { ...metadata, id: "latest-reading", sessionId: "latest", animalId: animal.id, liters: 11.5 }]
    });

    expect(statuses).toEqual([{ label: "11.5 L · último control", tone: "neutral" }]);
  });
});
