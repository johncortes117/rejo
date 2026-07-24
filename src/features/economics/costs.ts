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
