import { describe, expect, it } from "vitest";
import type { Heat, PregnancyCheck, Service } from "@/domain/models";
import { computeReproductiveState } from "@/features/reproduction/reproductive-state";

const recordMeta = {
  id: "event-1",
  farmId: "farm-1",
  createdAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-01T12:00:00.000Z",
  createdBy: "user-1"
};

const service = (date: string, serviceNumber = 1): Service => ({
  ...recordMeta,
  id: `service-${date}`,
  animalId: "animal-1",
  date,
  type: "ai",
  serviceNumber
});

const heat = (date: string): Heat => ({
  ...recordMeta,
  id: `heat-${date}`,
  animalId: "animal-1",
  date,
  served: false
});

const pregnancyCheck = (result: PregnancyCheck["result"]): PregnancyCheck => ({
  ...recordMeta,
  id: `check-${result}`,
  animalId: "animal-1",
  date: "2026-07-28",
  method: "palpation",
  result
});

describe("computeReproductiveState", () => {
  it("presumes pregnancy when a service has no return heat after day 26", () => {
    expect(computeReproductiveState({
      asOf: "2026-07-28",
      sex: "female",
      heats: [],
      services: [service("2026-07-01")],
      pregnancyChecks: [],
      calvings: []
    })).toMatchObject({
      status: "pregnant_presumed",
      expectedCalvingDate: "2027-04-07"
    });
  });

  it("returns to open when a heat appears in the expected return window", () => {
    expect(computeReproductiveState({
      asOf: "2026-07-28",
      sex: "female",
      heats: [heat("2026-07-21")],
      services: [service("2026-07-01")],
      pregnancyChecks: [],
      calvings: []
    })).toMatchObject({ status: "open", isRepeatBreeder: false });
  });

  it("marks a third unsuccessful service as a repeat breeder", () => {
    expect(computeReproductiveState({
      asOf: "2026-08-01",
      sex: "female",
      heats: [],
      services: [service("2026-05-01", 1), service("2026-06-01", 2), service("2026-07-01", 3)],
      pregnancyChecks: [pregnancyCheck("open")],
      calvings: []
    })).toMatchObject({ status: "open", isRepeatBreeder: true, serviceCount: 3 });
  });
});
