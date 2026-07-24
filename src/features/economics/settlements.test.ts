import { afterEach, describe, expect, it } from "vitest";
import { RejoDb } from "@/db/rejo-db";
import { recordSettlement } from "@/features/economics/settlements";

const databases: RejoDb[] = [];

const createDatabase = () => {
  const database = new RejoDb(`rejo-settlement-test-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
};

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => { database.close(); await database.delete(); }));
});

describe("recordSettlement", () => {
  it("persists an offline settlement, optional quality result, and fair-price reconciliation", async () => {
    const database = createDatabase();
    const farm = { id: "farm-1", farmId: "farm-1", name: "El Capulí", timezone: "America/Guayaquil", brucellosisFree: false, bppCertified: false, createdAt: "2026-07-24T12:00:00.000Z", updatedAt: "2026-07-24T12:00:00.000Z", createdBy: "user-1" };
    const result = await recordSettlement(database, { farmId: "farm-1", userId: "user-1", buyerId: "buyer-1", farm, periodStart: "2026-07-01", periodEnd: "2026-07-15", litersPaid: 1000, pricePerLiterPaid: 0.45, quality: { fatPct: 3.8, proteinPct: 3.1, ufc: 80000, ccs: 200000 } }, new Date("2026-07-24T12:00:00-05:00"));

    expect(result).toMatchObject({ legalPriceComputed: 0.5324, legalVariancePerLiter: 0.0824, varianceAmount: 82.4, reconciled: false });
    expect(await database.settlements.toArray()).toHaveLength(1);
    expect(await database.milkQualityTests.toArray()).toHaveLength(1);
    expect(await database.priceSettings.toArray()).toHaveLength(2);
    expect(await database.syncQueue.toArray()).toHaveLength(4);
  });
});
