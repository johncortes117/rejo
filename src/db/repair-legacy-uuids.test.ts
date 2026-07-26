import { afterEach, describe, expect, it } from "vitest";
import { repairFarmSessionIds, saveFarmSession, readFarmSession } from "@/db/bootstrap";
import { RejoDb } from "@/db/rejo-db";
import { repairLegacyUuid, repairLegacyUuidRecords } from "@/db/repair-legacy-uuids";

const databases: RejoDb[] = [];
const malformedFarmId = "019f9a97-6180-7a7f-95da-8c50993129f02";
const malformedAnimalId = "019f9a97-6181-7a7f-95da-8c50993129f03";

const createDatabase = () => {
  const database = new RejoDb(`rejo-legacy-uuid-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
};

afterEach(async () => {
  localStorage.clear();
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe("repairLegacyUuidRecords", () => {
  it("repairs malformed identifiers, relations, queue payloads, and the saved farm session", async () => {
    const database = createDatabase();
    const timestamp = "2026-07-25T18:44:00.000Z";
    const farmId = repairLegacyUuid(malformedFarmId);
    const animalId = repairLegacyUuid(malformedAnimalId);

    await database.farms.put({ id: malformedFarmId, farmId: malformedFarmId, name: "La Pintada", timezone: "America/Guayaquil", brucellosisFree: false, bppCertified: false, createdAt: timestamp, updatedAt: timestamp, createdBy: malformedFarmId });
    await database.animals.put({ id: malformedAnimalId, farmId: malformedFarmId, name: "Canela", motherId: malformedAnimalId, birthDateEstimated: true, status: "active", createdAt: timestamp, updatedAt: timestamp, createdBy: malformedFarmId });
    await database.syncQueue.put({ id: malformedAnimalId, farmId: malformedFarmId, entityTable: "animals", entityId: malformedAnimalId, operation: "upsert", payload: { id: malformedAnimalId, farmId: malformedFarmId, motherId: malformedAnimalId, createdBy: malformedFarmId }, idempotencyKey: malformedFarmId, attemptCount: 0, createdAt: timestamp });
    saveFarmSession({ farmId: malformedFarmId, userId: malformedFarmId, role: "owner" });

    const result = await repairLegacyUuidRecords(database);
    repairFarmSessionIds(result.replacements);

    expect(result.replacements.get(malformedFarmId)).toBe(farmId);
    expect(result.repairedRecords).toBe(3);
    expect(await database.farms.get(malformedFarmId)).toBeUndefined();
    expect(await database.farms.get(farmId)).toMatchObject({ id: farmId, farmId, createdBy: farmId });
    expect(await database.animals.get(animalId)).toMatchObject({ id: animalId, farmId, motherId: animalId, createdBy: farmId });
    expect(await database.syncQueue.get(animalId)).toMatchObject({ id: animalId, farmId, entityId: animalId, idempotencyKey: farmId, payload: { id: animalId, farmId, motherId: animalId, createdBy: farmId } });
    expect(readFarmSession()).toEqual({ farmId, userId: farmId, role: "owner" });
  });
});
