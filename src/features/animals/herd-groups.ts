import { createUuidV7 } from "@/domain/ids";
import type { HerdGroup } from "@/domain/models";
import { queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";

const defaults = ["En ordeño", "Secadas", "Vaconas", "Terneros"];

export const ensureDefaultHerdGroups = async (database: RejoDb, farmId: string, userId: string, now = new Date()): Promise<HerdGroup[]> => {
  const existing = await database.herdGroups.filter((group) => group.farmId === farmId && !group.deletedAt).toArray();
  if (existing.length) return existing.sort((left, right) => left.sortOrder - right.sortOrder);
  const timestamp = now.toISOString();
  const groups = defaults.map((name, sortOrder) => ({ id: createUuidV7(now.getTime() + sortOrder), farmId, name, sortOrder, isDefault: true, createdAt: timestamp, updatedAt: timestamp, createdBy: userId }));
  await database.transaction("rw", database.herdGroups, database.syncQueue, async () => { await database.herdGroups.bulkPut(groups); await database.syncQueue.bulkPut(groups.map((group) => queueUpsert(farmId, "herd_groups", group.id, group as unknown as Record<string, unknown>, timestamp))); });
  return groups;
};

export const createHerdGroup = async (database: RejoDb, farmId: string, userId: string, name: string, now = new Date()): Promise<HerdGroup> => {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Escribe el nombre del grupo.");
  const existing = await database.herdGroups.filter((group) => group.farmId === farmId && !group.deletedAt).toArray();
  if (existing.some((group) => group.name.toLocaleLowerCase("es-EC") === trimmedName.toLocaleLowerCase("es-EC"))) throw new Error("Ya existe un grupo con ese nombre.");
  const timestamp = now.toISOString();
  const group: HerdGroup = { id: createUuidV7(now.getTime()), farmId, name: trimmedName, sortOrder: existing.length, isDefault: false, createdAt: timestamp, updatedAt: timestamp, createdBy: userId };
  await database.transaction("rw", database.herdGroups, database.syncQueue, async () => { await database.herdGroups.put(group); await database.syncQueue.put(queueUpsert(farmId, "herd_groups", group.id, group as unknown as Record<string, unknown>, timestamp)); });
  return group;
};
