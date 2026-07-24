import { createUuidV7 } from "@/domain/ids";
import type { EntityId, SyncQueueItem } from "@/domain/models";

type SyncTable = SyncQueueItem["entityTable"];

export const queueUpsert = (
  farmId: EntityId,
  entityTable: SyncTable,
  entityId: EntityId,
  payload: Record<string, unknown>,
  createdAt: string
): SyncQueueItem => ({
  id: createUuidV7(),
  farmId,
  entityTable,
  entityId,
  operation: "upsert",
  payload,
  idempotencyKey: createUuidV7(),
  attemptCount: 0,
  createdAt
});

export const queueSoftDelete = (
  farmId: EntityId,
  entityTable: SyncTable,
  entityId: EntityId,
  payload: Record<string, unknown>,
  createdAt: string
): SyncQueueItem => ({
  id: createUuidV7(),
  farmId,
  entityTable,
  entityId,
  operation: "soft_delete",
  payload,
  idempotencyKey: createUuidV7(),
  attemptCount: 0,
  createdAt
});
