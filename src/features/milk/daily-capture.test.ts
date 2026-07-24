import { afterEach, describe, expect, it } from "vitest";
import { RejoDb } from "@/db/rejo-db";
import {
  captureDailyTankMeasurement,
  DuplicateTankReadingError
} from "@/features/milk/daily-capture";
import { getMilkDashboard } from "@/features/milk/dashboard";

const databases: RejoDb[] = [];

const createDatabase = () => {
  const database = new RejoDb("test-" + crypto.randomUUID());
  databases.push(database);
  return database;
};

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(async (database) => {
      database.close();
      await database.delete();
    })
  );
});

describe("captureDailyTankMeasurement", () => {
  it("persists the tank reading, calf milk use, and outbox operations atomically", async () => {
    const database = createDatabase();
    const result = await captureDailyTankMeasurement(database, {
      farmId: "farm-1",
      userId: "user-1",
      date: "2026-07-24",
      liters: 205,
      milkForCalvesLiters: 4,
      now: new Date("2026-07-24T12:00:00-05:00")
    });

    expect(result.reading.liters).toBe(205);
    expect((await database.tankReadings.toArray())).toHaveLength(1);
    expect((await database.milkUsages.toArray())).toMatchObject([{ type: "calves", liters: 4 }]);
    expect((await database.syncQueue.toArray())).toHaveLength(2);
  });

  it("requires an explicit replacement strategy for a same-day duplicate", async () => {
    const database = createDatabase();
    const input = {
      farmId: "farm-1",
      userId: "user-1",
      date: "2026-07-24",
      liters: 205,
      now: new Date("2026-07-24T12:00:00-05:00")
    };

    await captureDailyTankMeasurement(database, input);
    await expect(captureDailyTankMeasurement(database, input)).rejects.toBeInstanceOf(
      DuplicateTankReadingError
    );

    await captureDailyTankMeasurement(database, {
      ...input,
      liters: 207,
      duplicateStrategy: "replace"
    });

    const activeReadings = await database.tankReadings.filter((reading) => !reading.deletedAt).toArray();
    expect(activeReadings).toMatchObject([{ liters: 207 }]);
  });

  it("calculates a seven-day average without deleted records or another farm", async () => {
    const database = createDatabase();
    const now = new Date("2026-07-24T12:00:00-05:00");

    await captureDailyTankMeasurement(database, {
      farmId: "farm-1",
      userId: "user-1",
      date: "2026-07-23",
      liters: 200,
      now
    });
    await captureDailyTankMeasurement(database, {
      farmId: "farm-1",
      userId: "user-1",
      date: "2026-07-24",
      liters: 220,
      now
    });
    await captureDailyTankMeasurement(database, {
      farmId: "farm-2",
      userId: "user-2",
      date: "2026-07-24",
      liters: 999,
      now
    });

    await expect(getMilkDashboard(database, "farm-1", "2026-07-24")).resolves.toEqual({
      todayLiters: 220,
      sevenDayAverage: 210
    });
  });
});
