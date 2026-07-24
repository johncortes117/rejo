import { createUuidV7 } from "@/domain/ids";
import type { Buyer, Farm, TankCalibration } from "@/domain/models";
import { validateCalibrationPoints, type CalibrationPoint } from "@/domain/tank";
import { queueSoftDelete, queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";

const toPayload = (value: object): Record<string, unknown> =>
  value as Record<string, unknown>;

export interface SaveFarmSettingsInput {
  farm: Farm;
  buyer: Buyer;
  calibrationPoints: CalibrationPoint[];
  userId: string;
}

export const saveFarmSettings = async (
  database: RejoDb,
  input: SaveFarmSettingsInput,
  now = new Date()
): Promise<void> => {
  const validationError = validateCalibrationPoints(input.calibrationPoints);
  if (validationError) {
    throw new Error(validationError);
  }

  const timestamp = now.toISOString();
  const farm = { ...input.farm, updatedAt: timestamp };
  const buyer = { ...input.buyer, updatedAt: timestamp };
  const existingPoints = await database.tankCalibrations
    .filter((point) => point.farmId === farm.id && !point.deletedAt)
    .toArray();
  const nextPoints: TankCalibration[] = input.calibrationPoints.map((point, index) => ({
    id: createUuidV7(now.getTime() + index + 1),
    farmId: farm.id,
    mark: point.mark,
    liters: point.liters,
    unitLabel: "cm",
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.userId
  }));
  const archivedPoints = existingPoints.map((point) => ({
    ...point,
    deletedAt: timestamp,
    updatedAt: timestamp
  }));

  await database.transaction(
    "rw",
    database.farms,
    database.buyers,
    database.tankCalibrations,
    database.syncQueue,
    async () => {
      await database.farms.put(farm);
      await database.buyers.put(buyer);

      if (archivedPoints.length > 0) {
        await database.tankCalibrations.bulkPut(archivedPoints);
      }

      if (nextPoints.length > 0) {
        await database.tankCalibrations.bulkPut(nextPoints);
      }

      await database.syncQueue.bulkPut([
        queueUpsert(farm.id, "farms", farm.id, toPayload(farm), timestamp),
        queueUpsert(farm.id, "buyers", buyer.id, toPayload(buyer), timestamp),
        ...archivedPoints.map((point) =>
          queueSoftDelete(farm.id, "tank_calibrations", point.id, toPayload(point), timestamp)
        ),
        ...nextPoints.map((point) =>
          queueUpsert(farm.id, "tank_calibrations", point.id, toPayload(point), timestamp)
        )
      ]);
    }
  );
};
