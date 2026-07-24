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

export const renameHerdGroup = async (database: RejoDb, group: HerdGroup, name: string, now = new Date()): Promise<HerdGroup> => {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Escribe el nombre del grupo.");
  const groups = await database.herdGroups.filter((item) => item.farmId === group.farmId && !item.deletedAt).toArray();
  if (groups.some((item) => item.id !== group.id && item.name.toLocaleLowerCase("es-EC") === trimmedName.toLocaleLowerCase("es-EC"))) throw new Error("Ya existe un grupo con ese nombre.");
  const next = { ...group, name: trimmedName, updatedAt: now.toISOString() };
  await database.transaction("rw", database.herdGroups, database.syncQueue, async () => { await database.herdGroups.put(next); await database.syncQueue.put(queueUpsert(group.farmId, "herd_groups", next.id, next as unknown as Record<string, unknown>, next.updatedAt)); });
  return next;
};

export const reorderHerdGroup = async (database: RejoDb, groups: HerdGroup[], groupId: string, direction: -1 | 1, now = new Date()): Promise<void> => {
  const index = groups.findIndex((group) => group.id === groupId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= groups.length) return;
  const timestamp = now.toISOString();
  const next = [...groups];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  const updated = next.map((group, sortOrder) => ({ ...group, sortOrder, updatedAt: timestamp }));
  await database.transaction("rw", database.herdGroups, database.syncQueue, async () => { await database.herdGroups.bulkPut(updated); await database.syncQueue.bulkPut(updated.map((group) => queueUpsert(group.farmId, "herd_groups", group.id, group as unknown as Record<string, unknown>, timestamp))); });
};
