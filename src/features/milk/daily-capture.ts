import { createUuidV7 } from "@/domain/ids";
import { z } from "zod";
import { nowInFarmTimezone } from "@/domain/time";
import type { MilkUsage, TankReading } from "@/domain/models";
import { queueSoftDelete, queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";

const toPayload = (value: object): Record<string, unknown> =>
  value as Record<string, unknown>;

export class DuplicateTankReadingError extends Error {
  constructor() {
    super("Ya existe una medida del tanque para esta fecha.");
    this.name = "DuplicateTankReadingError";
  }
}

export interface CaptureDailyTankMeasurementInput {
  farmId: string;
  userId: string;
  date: string;
  liters: number;
  milkForCalvesLiters?: number;
  duplicateStrategy?: "reject" | "replace";
  replaceMilkUsageIds?: string[];
  now?: Date;
}

export interface CaptureDailyTankMeasurementResult {
  reading: TankReading;
  milkUsage?: MilkUsage;
}

const dailyCaptureSchema = z.object({
  farmId: z.string().min(1),
  userId: z.string().min(1),
  date: z.iso.date(),
  liters: z.number().finite().nonnegative(),
  milkForCalvesLiters: z.number().finite().nonnegative().optional(),
  duplicateStrategy: z.enum(["reject", "replace"]).optional(),
  replaceMilkUsageIds: z.array(z.string().min(1)).optional()
});

const activePickupReadingsForDate = (
  database: RejoDb,
  farmId: string,
  date: string,
  readBy: TankReading["readBy"]
): Promise<TankReading[]> =>
  database.tankReadings
    .filter(
      (reading) =>
        reading.farmId === farmId &&
        reading.date === date &&
        reading.moment === "at_pickup" &&
        reading.readBy === readBy &&
        !reading.deletedAt
    )
    .toArray();

export const captureDailyTankMeasurement = async (
  database: RejoDb,
  input: CaptureDailyTankMeasurementInput
): Promise<CaptureDailyTankMeasurementResult> => {
  const validation = dailyCaptureSchema.safeParse(input);
  if (!validation.success) {
    const field = validation.error.issues[0]?.path[0];
    throw new Error(
      field === "milkForCalvesLiters"
        ? "Ingresa una cantidad válida para los terneros."
        : "Ingresa una cantidad válida de litros."
    );
  }

  const instant = input.now ?? new Date();
  const timestamp = instant.toISOString();
  const localTime = nowInFarmTimezone(instant).time;
  const existing = await activePickupReadingsForDate(database, input.farmId, input.date, "farm");

  if (existing.length > 0 && input.duplicateStrategy !== "replace") {
    throw new DuplicateTankReadingError();
  }

  const reading: TankReading = {
    id: createUuidV7(instant.getTime()),
    farmId: input.farmId,
    date: input.date,
    time: localTime,
    moment: "at_pickup",
    liters: Math.round(input.liters * 10) / 10,
    readBy: "farm",
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.userId
  };

  const milkUsage =
    input.milkForCalvesLiters && input.milkForCalvesLiters > 0
      ? {
          id: createUuidV7(instant.getTime() + 1),
          farmId: input.farmId,
          date: input.date,
          type: "calves" as const,
          liters: Math.round(input.milkForCalvesLiters * 10) / 10,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: input.userId
        }
      : undefined;

  await database.transaction(
    "rw",
    database.tankReadings,
    database.milkUsages,
    database.syncQueue,
    async () => {
      if (input.duplicateStrategy === "replace") {
        const replaced = existing.map((item) => ({ ...item, deletedAt: timestamp, updatedAt: timestamp }));

        if (replaced.length > 0) {
          await database.tankReadings.bulkPut(replaced);
          await database.syncQueue.bulkPut(
            replaced.map((item) =>
              queueSoftDelete(input.farmId, "tank_readings", item.id, toPayload(item), timestamp)
            )
          );
        }

        const replacementUsageIds = new Set(input.replaceMilkUsageIds ?? []);
        const replacedMilkUsages = (await database.milkUsages.bulkGet([...replacementUsageIds]))
          .filter((item): item is MilkUsage => Boolean(item && item.farmId === input.farmId && item.type === "calves" && !item.deletedAt))
          .map((item) => ({ ...item, deletedAt: timestamp, updatedAt: timestamp }));
        if (replacedMilkUsages.length > 0) {
          await database.milkUsages.bulkPut(replacedMilkUsages);
          await database.syncQueue.bulkPut(
            replacedMilkUsages.map((item) =>
              queueSoftDelete(input.farmId, "milk_usages", item.id, toPayload(item), timestamp)
            )
          );
        }
      }

      await database.tankReadings.put(reading);
      await database.syncQueue.put(
        queueUpsert(input.farmId, "tank_readings", reading.id, toPayload(reading), timestamp)
      );

      if (milkUsage) {
        await database.milkUsages.put(milkUsage);
        await database.syncQueue.put(
          queueUpsert(input.farmId, "milk_usages", milkUsage.id, toPayload(milkUsage), timestamp)
        );
      }
    }
  );

  return { reading, milkUsage };
};

export const recordBuyerTankReading = async (
  database: RejoDb,
  input: { farmId: string; userId: string; date: string; liters: number },
  now = new Date()
): Promise<TankReading> => {
  if (!Number.isFinite(input.liters) || input.liters < 0) {
    throw new Error("Ingresa una cantidad válida declarada por el tanquero.");
  }

  const timestamp = now.toISOString();
  const existing = await activePickupReadingsForDate(database, input.farmId, input.date, "buyer");
  const reading: TankReading = {
    id: createUuidV7(now.getTime()),
    farmId: input.farmId,
    date: input.date,
    time: nowInFarmTimezone(now).time,
    moment: "at_pickup",
    liters: Math.round(input.liters * 10) / 10,
    readBy: "buyer",
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.userId
  };

  await database.transaction("rw", database.tankReadings, database.syncQueue, async () => {
    const replaced = existing.map((item) => ({ ...item, deletedAt: timestamp, updatedAt: timestamp }));
    if (replaced.length > 0) {
      await database.tankReadings.bulkPut(replaced);
      await database.syncQueue.bulkPut(replaced.map((item) => queueSoftDelete(input.farmId, "tank_readings", item.id, toPayload(item), timestamp)));
    }
    await database.tankReadings.put(reading);
    await database.syncQueue.put(queueUpsert(input.farmId, "tank_readings", reading.id, toPayload(reading), timestamp));
  });

  return reading;
};

export const softDeleteTankReading = async (
  database: RejoDb,
  reading: TankReading,
  now = new Date()
): Promise<void> => {
  const timestamp = now.toISOString();
  const deleted = { ...reading, deletedAt: timestamp, updatedAt: timestamp };

  await database.transaction("rw", database.tankReadings, database.syncQueue, async () => {
    await database.tankReadings.put(deleted);
    await database.syncQueue.put(
      queueSoftDelete(reading.farmId, "tank_readings", reading.id, toPayload(deleted), timestamp)
    );
  });
};
