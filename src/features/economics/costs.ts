import { createUuidV7 } from "@/domain/ids";
import { queueUpsert } from "@/db/outbox";
import type { Asset, LaborRecord, Transaction } from "@/domain/models";
import type { RejoDb } from "@/db/rejo-db";

export interface CostSummary {
  cashCost: number;
  depreciationCost: number;
  familyLaborCost: number;
  productionLiters: number;
  cashPerLiter?: number;
  withDepreciationPerLiter?: number;
  fullPerLiter?: number;
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const calculateCostSummary = (transactions: Transaction[], assets: Asset[], labor: LaborRecord[], productionLiters: number): CostSummary => {
  const cashCost = transactions.filter((item) => !item.deletedAt && item.direction === "expense").reduce((total, item) => total + item.amount, 0);
  const depreciationCost = assets.filter((item) => !item.deletedAt).reduce((total, item) => total + Math.max(0, item.purchaseValue - item.salvageValue) / Math.max(1, item.usefulLifeYears * 12), 0);
  const familyLaborCost = labor.filter((item) => !item.deletedAt && item.type === "family").reduce((total, item) => total + item.rate * item.daysWorked, 0);
  const perLiter = (value: number) => productionLiters > 0 ? money(value / productionLiters) : undefined;
  return { cashCost: money(cashCost), depreciationCost: money(depreciationCost), familyLaborCost: money(familyLaborCost), productionLiters, cashPerLiter: perLiter(cashCost), withDepreciationPerLiter: perLiter(cashCost + depreciationCost), fullPerLiter: perLiter(cashCost + depreciationCost + familyLaborCost) };
};

export const recordTransaction = async (database: RejoDb, input: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "createdBy"> & { userId: string }, now = new Date()): Promise<Transaction> => {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Escribe un valor mayor que cero.");
  if (!input.category.trim()) throw new Error("Describe el tipo de movimiento.");
  const timestamp = now.toISOString();
  const transaction: Transaction = { id: createUuidV7(now.getTime()), farmId: input.farmId, date: input.date, direction: input.direction, category: input.category.trim(), amount: input.amount, description: input.description?.trim() || undefined, isEstimated: input.isEstimated, createdAt: timestamp, updatedAt: timestamp, createdBy: input.userId };
  await database.transaction("rw", database.transactions, database.syncQueue, async () => { await database.transactions.put(transaction); await database.syncQueue.put(queueUpsert(transaction.farmId, "transactions", transaction.id, transaction as unknown as Record<string, unknown>, timestamp)); });
  return transaction;
};

export const recordAsset = async (database: RejoDb, input: Omit<Asset, "id" | "createdAt" | "updatedAt" | "createdBy"> & { userId: string }, now = new Date()): Promise<Asset> => {
  if (!input.name.trim() || !input.category.trim()) throw new Error("Describe el activo.");
  if (!Number.isFinite(input.purchaseValue) || input.purchaseValue <= 0) throw new Error("Escribe el valor de compra.");
  if (!Number.isInteger(input.usefulLifeYears) || input.usefulLifeYears <= 0) throw new Error("Escribe años de vida útil válidos.");
  if (!Number.isFinite(input.salvageValue) || input.salvageValue < 0) throw new Error("Revisa el valor de rescate.");
  const timestamp = now.toISOString();
  const asset: Asset = { id: createUuidV7(now.getTime()), farmId: input.farmId, name: input.name.trim(), category: input.category.trim(), purchaseDate: input.purchaseDate, purchaseValue: input.purchaseValue, usefulLifeYears: input.usefulLifeYears, salvageValue: input.salvageValue, createdAt: timestamp, updatedAt: timestamp, createdBy: input.userId };
  await database.transaction("rw", database.assets, database.syncQueue, async () => { await database.assets.put(asset); await database.syncQueue.put(queueUpsert(asset.farmId, "assets", asset.id, asset as unknown as Record<string, unknown>, timestamp)); });
  return asset;
};

export const recordLabor = async (database: RejoDb, input: Omit<LaborRecord, "id" | "createdAt" | "updatedAt" | "createdBy"> & { userId: string }, now = new Date()): Promise<LaborRecord> => {
  if (!input.workerName.trim()) throw new Error("Identifica el trabajo registrado.");
  if (!Number.isFinite(input.rate) || input.rate < 0 || !Number.isFinite(input.daysWorked) || input.daysWorked < 0) throw new Error("Revisa el valor y los días trabajados.");
  const timestamp = now.toISOString();
  const labor: LaborRecord = { id: createUuidV7(now.getTime()), farmId: input.farmId, workerName: input.workerName.trim(), type: input.type, rate: input.rate, daysWorked: input.daysWorked, period: input.period, createdAt: timestamp, updatedAt: timestamp, createdBy: input.userId };
  await database.transaction("rw", database.labor, database.syncQueue, async () => { await database.labor.put(labor); await database.syncQueue.put(queueUpsert(labor.farmId, "labor", labor.id, labor as unknown as Record<string, unknown>, timestamp)); });
  return labor;
};
