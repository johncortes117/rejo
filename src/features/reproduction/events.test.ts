import { afterEach, describe, expect, it } from "vitest";
import { RejoDb } from "@/db/rejo-db";
import { recordCalving, recordDryOff } from "@/features/reproduction/events";

const databases: RejoDb[] = [];

const createTestFarmDatabase = (): RejoDb => {
  const database = new RejoDb(`rejo-reproduction-test-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
};

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe("reproductive events", () => {
  it("creates a female calf and her brucellosis task atomically", async () => {
    const database = createTestFarmDatabase();
    const result = await recordCalving(database, {
      farmId: "test-farm",
      animalId: "mother-1",
      userId: "test-user",
      date: "2026-07-24",
      calfName: "Lucera",
      calfSex: "female"
    }, new Date("2026-07-24T12:00:00.000Z"));

    expect(await database.animals.get(result.calf.id)).toMatchObject({ motherId: "mother-1", birthDate: "2026-07-24" });
    expect(await database.calvings.get(result.calving.id)).toMatchObject({ calfIds: [result.calf.id] });
    expect(result.task).toMatchObject({ taskType: "brucellosis_vaccination", dueDate: "2026-10-22" });
    expect(await database.syncQueue.count()).toBe(3);
  });

  it("stores dry-off offline with a sync operation", async () => {
    const database = createTestFarmDatabase();
    const event = await recordDryOff(database, {
      farmId: "test-farm",
      animalId: "mother-1",
      userId: "test-user",
      date: "2026-07-24"
    });

    expect(await database.dryOffs.get(event.id)).toMatchObject({ animalId: "mother-1" });
    expect(await database.syncQueue.count()).toBe(1);
  });
});
