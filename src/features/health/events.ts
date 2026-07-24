import { createUuidV7 } from "@/domain/ids";
import type { HealthEvent } from "@/domain/models";
import { queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";

export interface RecordHealthEventInput {
  farmId: string;
  animalId: string;
  userId: string;
  date: string;
  type: HealthEvent["type"];
  productName?: string;
  activeIngredient?: string;
  milkWithdrawalHours?: number;
  notes?: string;
}

export const recordHealthEvent = async (
  database: RejoDb,
  input: RecordHealthEventInput,
  now = new Date()
): Promise<HealthEvent> => {
  if (input.milkWithdrawalHours !== undefined && input.milkWithdrawalHours < 0) {
    throw new Error("Las horas de retiro no pueden ser negativas.");
  }

  const timestamp = now.toISOString();
  const event: HealthEvent = {
    id: createUuidV7(now.getTime()),
    farmId: input.farmId,
    animalId: input.animalId,
    date: input.date,
    type: input.type,
    productName: input.productName?.trim() || undefined,
    activeIngredient: input.activeIngredient?.trim() || undefined,
    milkWithdrawalHours: input.milkWithdrawalHours,
    notes: input.notes?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.userId
  };

  await database.transaction("rw", database.healthEvents, database.syncQueue, async () => {
    await database.healthEvents.put(event);
    await database.syncQueue.put(
      queueUpsert(event.farmId, "health_events", event.id, event as unknown as Record<string, unknown>, timestamp)
    );
  });

  return event;
};
