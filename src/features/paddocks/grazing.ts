import { createUuidV7 } from "@/domain/ids";
import type { GrazingLot, GrazingRecord, Paddock, PaddockUse } from "@/domain/models";
import { queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";

export interface PaddockDecision {
  paddock: Paddock;
  state: "occupied" | "ready" | "resting" | "untracked";
  detail: string;
  activeLotId?: string;
}

const dayDifference = (start: string, end: string) => Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000));

export const getPaddockDecisions = (paddocks: Paddock[], records: GrazingRecord[], date: string): PaddockDecision[] => paddocks
  .filter((paddock) => !paddock.deletedAt)
  .map((paddock) => {
    const history = records.filter((record) => !record.deletedAt && record.paddockId === paddock.id).sort((left, right) => right.enteredAt.localeCompare(left.enteredAt));
    const active = history.find((record) => !record.exitedAt);
    if (active) return { paddock, state: "occupied", detail: "Hay un lote en este potrero.", activeLotId: active.lotId };
    const lastExit = history.filter((record) => record.exitedAt).sort((left, right) => right.exitedAt!.localeCompare(left.exitedAt!))[0]?.exitedAt;
    if (!lastExit) return { paddock, state: "untracked", detail: "Aún no hay una salida registrada." };
    const restedDays = dayDifference(lastExit, date);
    if (restedDays >= paddock.targetRestDays) return { paddock, state: "ready", detail: `Descansó ${restedDays} días; puede reingresar.` };
    return { paddock, state: "resting", detail: `Descansó ${restedDays} de ${paddock.targetRestDays} días.` };
  });

const requireName = (name: string, type: "potrero" | "lote") => {
  const trimmed = name.trim();
  if (!trimmed) throw new Error(`Escribe el nombre del ${type}.`);
  return trimmed;
};

export const createPaddock = async (database: RejoDb, input: { farmId: string; userId: string; name: string; use: PaddockUse; areaHectares?: number; infrastructure?: string; targetRestDays: number }, now = new Date()): Promise<Paddock> => {
  const name = requireName(input.name, "potrero");
  if (!Number.isInteger(input.targetRestDays) || input.targetRestDays < 0) throw new Error("Los días de descanso deben ser cero o más.");
  const timestamp = now.toISOString();
  const paddock: Paddock = { id: createUuidV7(now.getTime()), farmId: input.farmId, name, use: input.use, areaHectares: input.areaHectares, infrastructure: input.infrastructure?.trim() || undefined, targetRestDays: input.targetRestDays, createdAt: timestamp, updatedAt: timestamp, createdBy: input.userId };
  await database.transaction("rw", database.paddocks, database.syncQueue, async () => { await database.paddocks.put(paddock); await database.syncQueue.put(queueUpsert(paddock.farmId, "paddocks", paddock.id, paddock as unknown as Record<string, unknown>, timestamp)); });
  return paddock;
};

export const createGrazingLot = async (database: RejoDb, input: { farmId: string; userId: string; name: string; notes?: string }, now = new Date()): Promise<GrazingLot> => {
  const timestamp = now.toISOString();
  const lot: GrazingLot = { id: createUuidV7(now.getTime()), farmId: input.farmId, name: requireName(input.name, "lote"), notes: input.notes?.trim() || undefined, createdAt: timestamp, updatedAt: timestamp, createdBy: input.userId };
  await database.transaction("rw", database.grazingLots, database.syncQueue, async () => { await database.grazingLots.put(lot); await database.syncQueue.put(queueUpsert(lot.farmId, "grazing_lots", lot.id, lot as unknown as Record<string, unknown>, timestamp)); });
  return lot;
};

export const moveGrazingLot = async (database: RejoDb, input: { farmId: string; userId: string; lotId: string; paddockId: string; date: string }, now = new Date()): Promise<GrazingRecord> => {
  if (!input.date) throw new Error("Elige la fecha del movimiento.");
  const active = await database.grazingRecords.filter((record) => record.farmId === input.farmId && record.lotId === input.lotId && !record.deletedAt && !record.exitedAt).toArray();
  if (active.some((record) => record.paddockId === input.paddockId)) throw new Error("Ese lote ya está en este potrero.");
  const timestamp = now.toISOString();
  const closed = active.map((record) => ({ ...record, exitedAt: input.date, updatedAt: timestamp }));
  const next: GrazingRecord = { id: createUuidV7(now.getTime()), farmId: input.farmId, lotId: input.lotId, paddockId: input.paddockId, enteredAt: input.date, createdAt: timestamp, updatedAt: timestamp, createdBy: input.userId };
  await database.transaction("rw", database.grazingRecords, database.syncQueue, async () => {
    if (closed.length) await database.grazingRecords.bulkPut(closed);
    await database.grazingRecords.put(next);
    await database.syncQueue.bulkPut([...closed.map((record) => queueUpsert(input.farmId, "grazing_records", record.id, record as unknown as Record<string, unknown>, timestamp)), queueUpsert(input.farmId, "grazing_records", next.id, next as unknown as Record<string, unknown>, timestamp)]);
  });
  return next;
};
