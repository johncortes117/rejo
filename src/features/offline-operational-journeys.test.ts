import { afterEach, describe, expect, it } from "vitest";
import { RejoDb } from "@/db/rejo-db";
import type { Farm } from "@/domain/models";
import { saveAnimal } from "@/features/animals/animals";
import { recordTransaction } from "@/features/economics/costs";
import { recordSettlement } from "@/features/economics/settlements";
import { recordHealthEvent } from "@/features/health/events";
import { captureDailyTankMeasurement } from "@/features/milk/daily-capture";
import { createGrazingLot, createPaddock, moveGrazingLot } from "@/features/paddocks/grazing";

const databases: RejoDb[] = [];

const createDatabase = () => {
  const database = new RejoDb(`rejo-offline-journeys-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
};

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => {
    database.close();
    await database.delete();
  }));
});

describe("offline operational journeys", () => {
  it("keeps daily farm records local and queued across the primary workflows", async () => {
    const database = createDatabase();
    const now = new Date("2026-07-24T12:00:00.000Z");
    const farm: Farm = {
      id: "farm",
      farmId: "farm",
      name: "La Pintada",
      timezone: "America/Guayaquil",
      brucellosisFree: false,
      bppCertified: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: "owner"
    };

    await captureDailyTankMeasurement(database, {
      farmId: farm.id,
      userId: "owner",
      date: "2026-07-24",
      liters: 205,
      milkForCalvesLiters: 4,
      now
    });
    const animal = await saveAnimal(database, { farmId: farm.id, userId: "owner", name: "Lucero", sex: "female" }, now);
    await recordHealthEvent(database, { farmId: farm.id, userId: "owner", animalId: animal.id, date: "2026-07-24", type: "mastitis", milkWithdrawalHours: 96 }, now);
    const paddock = await createPaddock(database, { farmId: farm.id, userId: "owner", name: "La loma", use: "pasture", targetRestDays: 21 }, now);
    const lot = await createGrazingLot(database, { farmId: farm.id, userId: "owner", name: "Vacas de leche" }, now);
    await moveGrazingLot(database, { farmId: farm.id, userId: "owner", lotId: lot.id, paddockId: paddock.id, date: "2026-07-24" }, now);
    await recordSettlement(database, { farmId: farm.id, userId: "owner", buyerId: "buyer", farm, periodStart: "2026-07-01", periodEnd: "2026-07-15", litersPaid: 1000, pricePerLiterPaid: 0.45 }, now);
    await recordTransaction(database, { farmId: farm.id, userId: "owner", date: "2026-07-24", direction: "expense", category: "Molido", amount: 35.5, isEstimated: false }, now);

    expect(await database.tankReadings.count()).toBe(1);
    expect(await database.milkUsages.count()).toBe(1);
    expect(await database.animals.get(animal.id)).toMatchObject({ name: "Lucero", status: "active" });
    expect(await database.healthEvents.count()).toBe(1);
    expect(await database.grazingRecords.count()).toBe(1);
    expect(await database.settlements.count()).toBe(1);
    expect(await database.transactions.count()).toBe(1);

    const queuedTables = (await database.syncQueue.toArray()).map((operation) => operation.entityTable);
    expect(queuedTables).toEqual(expect.arrayContaining([
      "tank_readings",
      "milk_usages",
      "animals",
      "health_events",
      "paddocks",
      "grazing_lots",
      "grazing_records",
      "settlements",
      "transactions"
    ]));
    expect((await database.syncQueue.toArray()).every((operation) => !operation.completedAt)).toBe(true);
  });
});
