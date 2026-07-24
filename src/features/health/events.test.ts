import { afterEach, describe, expect, it } from "vitest";
import { RejoDb } from "@/db/rejo-db";
import { recordHealthEvent } from "@/features/health/events";

const databases: RejoDb[] = [];

const createTestFarmDatabase = (): RejoDb => {
  const database = new RejoDb(`rejo-health-test-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
};

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe("recordHealthEvent", () => {
  it("stores a treatment and its durable sync operation in a test farm", async () => {
    const database = createTestFarmDatabase();

    const event = await recordHealthEvent(database, {
      farmId: "test-farm",
      animalId: "test-animal",
      userId: "test-user",
      date: "2026-07-24",
      type: "mastitis",
      productName: "Treatment A",
      milkWithdrawalHours: 96
    }, new Date("2026-07-24T12:00:00.000Z"));

    expect(await database.healthEvents.get(event.id)).toMatchObject({
      farmId: "test-farm",
      animalId: "test-animal",
      milkWithdrawalHours: 96
    });
    const queuedOperation = (await database.syncQueue.toArray()).find((item) => item.entityId === event.id);
    expect(queuedOperation).toMatchObject({
      entityTable: "health_events",
      operation: "upsert"
    });
  });
});
