import { createUuidV7 } from "@/domain/ids";
import type { Animal, Calving, DryOff, HealthPlanTask, Heat, PregnancyCheck, Service } from "@/domain/models";
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

const addDays = (date: string, days: number): string => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

export const recordCalving = async (
  database: RejoDb,
  input: EventInput & { calfName: string; calfSex: "female" | "male" },
  now = new Date()
): Promise<{ calving: Calving; calf: Animal; task?: HealthPlanTask }> => {
  const calfName = input.calfName.trim();
  if (!calfName) {
    throw new Error("Escribe el nombre de la cría.");
  }

  const timestamp = now.toISOString();
  const calf: Animal = {
    id: createUuidV7(now.getTime()),
    farmId: input.farmId,
    name: calfName,
    sex: input.calfSex,
    birthDate: input.date,
    birthDateEstimated: false,
    motherId: input.animalId,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.userId
  };
  const calving: Calving = {
    id: createUuidV7(now.getTime() + 1),
    farmId: input.farmId,
    animalId: input.animalId,
    date: input.date,
    type: "normal",
    outcome: "live",
    calfIds: [calf.id],
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.userId
  };
  const task: HealthPlanTask | undefined = input.calfSex === "female" ? {
    id: createUuidV7(now.getTime() + 2),
    farmId: input.farmId,
    animalId: calf.id,
    category: "calf",
    taskType: "brucellosis_vaccination",
    dueDate: addDays(input.date, 90),
    isTemplate: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.userId
  } : undefined;

  await database.transaction("rw", database.animals, database.calvings, database.healthPlanTasks, database.syncQueue, async () => {
    await database.animals.put(calf);
    await database.calvings.put(calving);
    await database.syncQueue.bulkPut([
      queueUpsert(calf.farmId, "animals", calf.id, asPayload(calf), timestamp),
      queueUpsert(calving.farmId, "calvings", calving.id, asPayload(calving), timestamp),
      ...(task ? [queueUpsert(task.farmId, "health_plan_tasks", task.id, asPayload(task), timestamp)] : [])
    ]);
    if (task) {
      await database.healthPlanTasks.put(task);
    }
  });

  return { calving, calf, task };
};

export const recordDryOff = async (
  database: RejoDb,
  input: EventInput,
  now = new Date()
): Promise<DryOff> => {
  const timestamp = now.toISOString();
  const dryOff: DryOff = {
    id: createUuidV7(now.getTime()),
    farmId: input.farmId,
    animalId: input.animalId,
    date: input.date,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.userId
  };

  await database.transaction("rw", database.dryOffs, database.syncQueue, async () => {
    await database.dryOffs.put(dryOff);
    await database.syncQueue.put(queueUpsert(dryOff.farmId, "dry_offs", dryOff.id, asPayload(dryOff), timestamp));
  });

  return dryOff;
};
