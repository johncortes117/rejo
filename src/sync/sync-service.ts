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
  dry_offs: "dry_offs",
  health_events: "health_events",
  health_plan_tasks: "health_plan_tasks",
  milk_quality_tests: "milk_quality_tests",
  price_settings: "price_settings",
  settlements: "settlements",
  transactions: "transactions",
  assets: "assets",
  labor: "labor",
  herd_groups: "herd_groups",
  paddocks: "paddocks",
  grazing_lots: "grazing_lots",
  grazing_records: "grazing_records",
  milk_control_sessions: "milk_control_sessions",
  milk_control_records: "milk_control_records"
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
  previousCalvingCount: "previous_calving_count",
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
  expectedCalvingDate: "expected_calving_date",
  productName: "product_name",
  activeIngredient: "active_ingredient",
  milkWithdrawalHours: "milk_withdrawal_hours",
  motherId: "mother_id",
  dueDate: "due_date",
  completedAt: "completed_at",
  ignoredAt: "ignored_at",
  recurrenceDays: "recurrence_days",
  isTemplate: "is_template",
  taskType: "task_type",
  effectiveFrom: "effective_from",
  supportPrice: "support_price",
  historicalFloor: "historical_floor",
  fatBase: "fat_base",
  fatStep: "fat_step",
  fatPricePerStep: "fat_price_per_step",
  proteinBase: "protein_base",
  proteinStep: "protein_step",
  proteinPricePerStep: "protein_price_per_step",
  ufcBase: "ufc_base",
  ufcStep: "ufc_step",
  ufcPricePerStep: "ufc_price_per_step",
  ccsBase: "ccs_base",
  ccsStep: "ccs_step",
  ccsPricePerStep: "ccs_price_per_step",
  brucellosisFreeBonus: "brucellosis_free_bonus",
  bppBonus: "bpp_bonus",
  sourceDocument: "source_document",
  fatPct: "fat_pct",
  proteinPct: "protein_pct",
  qualityTestId: "quality_test_id",
  periodStart: "period_start",
  periodEnd: "period_end",
  litersPaid: "liters_paid",
  pricePerLiterPaid: "price_per_liter_paid",
  totalPaid: "total_paid",
  varianceLiters: "variance_liters",
  varianceAmount: "variance_amount",
  legalPriceComputed: "legal_price_computed",
  legalVariancePerLiter: "legal_variance_per_liter",
  purchaseDate: "purchase_date",
  purchaseValue: "purchase_value",
  usefulLifeYears: "useful_life_years",
  salvageValue: "salvage_value",
  workerName: "worker_name",
  daysWorked: "days_worked",
  isEstimated: "is_estimated",
  herdGroupId: "herd_group_id",
  sortOrder: "sort_order",
  isDefault: "is_default",
  areaHectares: "area_hectares",
  targetRestDays: "target_rest_days",
  paddockId: "paddock_id",
  lotId: "lot_id",
  enteredAt: "entered_at",
  exitedAt: "exited_at",
  sessionId: "session_id"
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
  | "dryOffs"
  | "healthEvents"
  | "healthPlanTasks"
  | "milkQualityTests"
  | "priceSettings"
  | "settlements"
  | "transactions"
  | "assets"
  | "labor"
  | "herdGroups"
  | "paddocks"
  | "grazingLots"
  | "grazingRecords"
  | "milkControlSessions"
  | "milkControlRecords";

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
  dry_offs: "dryOffs",
  health_events: "healthEvents",
  health_plan_tasks: "healthPlanTasks",
  milk_quality_tests: "milkQualityTests",
  price_settings: "priceSettings",
  settlements: "settlements",
  transactions: "transactions",
  assets: "assets",
  labor: "labor",
  herd_groups: "herdGroups",
  paddocks: "paddocks",
  grazing_lots: "grazingLots",
  grazing_records: "grazingRecords",
  milk_control_sessions: "milkControlSessions",
  milk_control_records: "milkControlRecords"
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

const establishRemoteFarmAccess = async (
  database: RejoDb,
  farmId: string
): Promise<string | undefined> => {
  const farm = await database.farms.get(farmId);

  if (!farm) {
    return "No se encontrÃ³ la finca local que corresponde a estos cambios.";
  }

  const { error } = await supabase!.rpc("bootstrap_farm", {
    p_farm_id: farm.id,
    p_name: farm.name,
    p_owner_name: farm.ownerName ?? null,
    p_timezone: farm.timezone,
    p_created_at: farm.createdAt
  });

  return error?.message;
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
    if (pendingItems.length > 0) {
      const farmAccessError = await establishRemoteFarmAccess(database, farmId);

      if (farmAccessError) {
        await markAttempt(database, pendingItems[0], farmAccessError);
        return { state: "failed", processed, error: farmAccessError };
      }
    }

    for (const item of pendingItems) {
      if (item.entityTable === "farms") {
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
