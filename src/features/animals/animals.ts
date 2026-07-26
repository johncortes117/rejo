import { createUuidV7 } from "@/domain/ids";
import type { Animal, AnimalPhotoCrop, AnimalSex } from "@/domain/models";
import { queueSoftDelete, queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";

const toPayload = (value: object): Record<string, unknown> =>
  value as Record<string, unknown>;

export interface SaveAnimalInput {
  farmId: string;
  userId: string;
  name: string;
  sex?: AnimalSex;
  approximateAgeMonths?: number;
  id?: string;
  photoUrl?: string | null;
  photoCrop?: AnimalPhotoCrop | null;
  previousCalvingCount?: number | null;
  herdGroupId?: string;
}

const estimateBirthDate = (months: number, now: Date): string => {
  const result = new Date(now);
  result.setUTCMonth(result.getUTCMonth() - months);
  return result.toISOString().slice(0, 10);
};

export const saveAnimal = async (
  database: RejoDb,
  input: SaveAnimalInput,
  now = new Date()
): Promise<Animal> => {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Escribe el nombre de la vaca.");
  }

  const existing = input.id ? await database.animals.get(input.id) : undefined;
  const timestamp = now.toISOString();
  const approximateAge =
    input.approximateAgeMonths === undefined || Number.isNaN(input.approximateAgeMonths)
      ? undefined
      : Math.max(0, input.approximateAgeMonths);
  const previousCalvingCount =
    input.previousCalvingCount === null
      ? undefined
      : input.previousCalvingCount === undefined || Number.isNaN(input.previousCalvingCount)
        ? existing?.previousCalvingCount
        : Math.max(0, Math.floor(input.previousCalvingCount));
  const animal: Animal = {
    id: existing?.id ?? createUuidV7(now.getTime()),
    farmId: input.farmId,
    name,
    sex: input.sex,
    birthDate:
      approximateAge === undefined ? existing?.birthDate : estimateBirthDate(approximateAge, now),
    birthDateEstimated: approximateAge !== undefined || existing?.birthDateEstimated || false,
    photoUrl: input.photoUrl === null ? undefined : input.photoUrl ?? existing?.photoUrl,
    photoCrop: input.photoUrl === null || input.photoCrop === null ? undefined : input.photoCrop ?? existing?.photoCrop,
    previousCalvingCount,
    herdGroupId: input.herdGroupId ?? existing?.herdGroupId,
    status: existing?.status ?? "active",
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    createdBy: existing?.createdBy ?? input.userId
  };

  await database.transaction("rw", database.animals, database.syncQueue, async () => {
    await database.animals.put(animal);
    await database.syncQueue.put(
      queueUpsert(
        animal.farmId,
        "animals",
        animal.id,
        toPayload({
          ...animal,
          ...(input.photoUrl === null ? { photoUrl: null } : {}),
          ...(input.photoUrl === null || input.photoCrop === null ? { photoCrop: null } : {}),
          ...(input.previousCalvingCount === null ? { previousCalvingCount: null } : {})
        }),
        timestamp
      )
    );
  });

  return animal;
};

export const archiveAnimal = async (
  database: RejoDb,
  animal: Animal,
  now = new Date()
): Promise<void> => {
  const timestamp = now.toISOString();
  const archived = { ...animal, deletedAt: timestamp, updatedAt: timestamp };

  await database.transaction("rw", database.animals, database.syncQueue, async () => {
    await database.animals.put(archived);
    await database.syncQueue.put(
      queueSoftDelete(animal.farmId, "animals", animal.id, toPayload(archived), timestamp)
    );
  });
};
