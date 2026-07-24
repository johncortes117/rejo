import { createUuidV7 } from "@/domain/ids";
import type { Heat, PregnancyCheck, Service } from "@/domain/models";
import { queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";

const asPayload = (value: object): Record<string, unknown> => value as Record<string, unknown>;

interface EventInput {
  farmId: string;
  animalId: string;
  userId: string;
  date: string;
}

export const recordHeat = async (
  database: RejoDb,
  input: EventInput,
  now = new Date()
): Promise<Heat> => {
  const timestamp = now.toISOString();
  const heat: Heat = {
    id: createUuidV7(now.getTime()),
    farmId: input.farmId,
    animalId: input.animalId,
    date: input.date,
    served: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.userId
  };

  await database.transaction("rw", database.heats, database.syncQueue, async () => {
    await database.heats.put(heat);
    await database.syncQueue.put(queueUpsert(heat.farmId, "heats", heat.id, asPayload(heat), timestamp));
  });

  return heat;
};

export const recordService = async (
  database: RejoDb,
  input: EventInput & { type: Service["type"] },
  now = new Date()
): Promise<Service> => {
  const timestamp = now.toISOString();
  const previousServices = await database.services
    .filter((item) => item.farmId === input.farmId && item.animalId === input.animalId && !item.deletedAt)
    .count();
  const service: Service = {
    id: createUuidV7(now.getTime()),
    farmId: input.farmId,
    animalId: input.animalId,
    date: input.date,
    type: input.type,
    serviceNumber: previousServices + 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.userId
  };

  await database.transaction("rw", database.services, database.syncQueue, async () => {
    await database.services.put(service);
    await database.syncQueue.put(queueUpsert(service.farmId, "services", service.id, asPayload(service), timestamp));
  });

  return service;
};

export const recordPregnancyCheck = async (
  database: RejoDb,
  input: EventInput & { result: PregnancyCheck["result"] },
  now = new Date()
): Promise<PregnancyCheck> => {
  const timestamp = now.toISOString();
  const check: PregnancyCheck = {
    id: createUuidV7(now.getTime()),
    farmId: input.farmId,
    animalId: input.animalId,
    date: input.date,
    method: "palpation",
    result: input.result,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.userId
  };

  await database.transaction("rw", database.pregnancyChecks, database.syncQueue, async () => {
    await database.pregnancyChecks.put(check);
    await database.syncQueue.put(queueUpsert(check.farmId, "pregnancy_checks", check.id, asPayload(check), timestamp));
  });

  return check;
};
