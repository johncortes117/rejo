import type { Table } from "dexie";
import type { RecordMeta, SyncQueueItem } from "@/domain/models";
import type { RejoDb } from "@/db/rejo-db";
import { isSupabaseConfigured, supabase } from "@/sync/supabase";

const remoteTableNames: Record<SyncQueueItem["entityTable"], string> = {
  farms: "farms",
  buyers: "buyers",
  tank_calibrations: "tank_calibrations",
  animals: "animals",
  tank_readings: "tank_readings",
  milk_usages: "milk_usages",
  heats: "heats",
  services: "services",
  pregnancy_checks: "pregnancy_checks",
  calvings: "calvings",
  dry_offs: "dry_offs"
};

const camelToSnake: Record<string, string> = {
  farmId: "farm_id",
  createdAt: "created_at",
  updatedAt: "updated_at",
  deletedAt: "deleted_at",
  syncedAt: "synced_at",
  createdBy: "created_by",
  ownerName: "owner_name",
  altitudeM: "altitude_m",
  brucellosisFree: "brucellosis_free",
  bppCertified: "bpp_certified",
  paymentFrequency: "payment_frequency",
  agreedPricePerLiter: "agreed_price_per_liter",
  paysQualityBonus: "pays_quality_bonus",
  unitLabel: "unit_label",
  birthDate: "birth_date",
  birthDateEstimated: "birth_date_estimated",
  photoUrl: "photo_url",
  readBy: "read_by",
  animalId: "animal_id",
  detectedBy: "detected_by",
  detectedWhere: "detected_where",
  bullId: "bull_id",
  strawCode: "straw_code",
  strawBullName: "straw_bull_name",
  serviceNumber: "service_number",
  estimatedDays: "estimated_days",
  calfIds: "calf_ids",
  plannedDate: "planned_date",
  treatmentApplied: "treatment_applied",
  expectedCalvingDate: "expected_calving_date"
};

const snakeToCamel = Object.fromEntries(
  Object.entries(camelToSnake).map(([camelCase, snakeCase]) => [snakeCase, camelCase])
);

const toRemoteRecord = (payload: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [camelToSnake[key] ?? key, value])
  );

const toLocalRecord = (payload: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [snakeToCamel[key] ?? key, value])
  );

type LocalTableKey =
  | "farms"
  | "buyers"
  | "tankCalibrations"
  | "animals"
  | "tankReadings"
  | "milkUsages"
  | "heats"
  | "services"
  | "pregnancyChecks"
  | "calvings"
  | "dryOffs";

const localTableKeys: Record<SyncQueueItem["entityTable"], LocalTableKey> = {
  farms: "farms",
  buyers: "buyers",
  tank_calibrations: "tankCalibrations",
  animals: "animals",
  tank_readings: "tankReadings",
  milk_usages: "milkUsages",
  heats: "heats",
  services: "services",
  pregnancy_checks: "pregnancyChecks",
  calvings: "calvings",
  dry_offs: "dryOffs"
};

const getTable = (
  database: RejoDb,
  entityTable: SyncQueueItem["entityTable"]
): Table<RecordMeta, string> =>
  database[localTableKeys[entityTable]] as unknown as Table<RecordMeta, string>;

export type SyncStatus =
  | { state: "synced"; processed: number }
  | { state: "offline"; processed: 0 }
  | { state: "unconfigured"; processed: 0 }
  | { state: "failed"; processed: number; error: string };

const markAttempt = async (
  database: RejoDb,
  item: SyncQueueItem,
  error?: string
): Promise<void> => {
  await database.syncQueue.put({
    ...item,
    attemptCount: item.attemptCount + 1,
    lastAttemptAt: new Date().toISOString(),
    lastError: error
  });
};

export const syncPendingOperations = async (
  database: RejoDb,
  farmId: string
): Promise<SyncStatus> => {
  if (!navigator.onLine) {
    return { state: "offline", processed: 0 };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { state: "unconfigured", processed: 0 };
  }

  const pendingItems = await database.syncQueue
    .filter((item) => item.farmId === farmId && !item.completedAt)
    .sortBy("createdAt");
  let processed = 0;

  try {
    for (const item of pendingItems) {
      if (item.entityTable === "farms") {
        const { error } = await supabase.rpc("bootstrap_farm", {
          p_farm_id: item.entityId,
          p_name: item.payload.name,
          p_owner_name: item.payload.ownerName ?? null,
          p_timezone: item.payload.timezone,
          p_created_at: item.payload.createdAt
        });

        if (error) {
          await markAttempt(database, item, error.message);
          return { state: "failed", processed, error: error.message };
        }

        await database.syncQueue.put({
          ...item,
          completedAt: new Date().toISOString(),
          lastAttemptAt: new Date().toISOString(),
          lastError: undefined
        });
        processed += 1;
        continue;
      }

      const remoteTable = remoteTableNames[item.entityTable];
      const { error } = await supabase.from(remoteTable).upsert(toRemoteRecord(item.payload), {
        onConflict: "id"
      });

      if (error) {
        await markAttempt(database, item, error.message);
        return { state: "failed", processed, error: error.message };
      }

      await database.syncQueue.put({
        ...item,
        completedAt: new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
        lastError: undefined
      });
      processed += 1;
    }

    return { state: "synced", processed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo respaldar la información.";
    return { state: "failed", processed, error: message };
  }
};

export const pullFarmChanges = async (database: RejoDb, farmId: string): Promise<void> => {
  if (!navigator.onLine || !isSupabaseConfigured || !supabase) {
    return;
  }

  for (const [entityTable, remoteTable] of Object.entries(remoteTableNames) as Array<
    [SyncQueueItem["entityTable"], string]
  >) {
    const { data, error } = await supabase.from(remoteTable).select("*").eq("farm_id", farmId);
    if (error || !data) {
      continue;
    }

    const table = getTable(database, entityTable);
    for (const remoteRecord of data as Record<string, unknown>[]) {
      const localRecord = toLocalRecord(remoteRecord) as unknown as RecordMeta;
      const existing = await table.get(localRecord.id);

      if (!existing || existing.updatedAt < localRecord.updatedAt) {
        await table.put(localRecord);
      }
    }
  }
};
