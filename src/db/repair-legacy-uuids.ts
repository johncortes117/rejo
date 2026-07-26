import type { Table } from "dexie";
import type { RejoDb } from "@/db/rejo-db";

type StoredRecord = Record<string, unknown>;
type StoredTable = Table<StoredRecord, string>;

const legacyUuidPattern = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[0-9a-f]$/i;

export const repairLegacyUuid = (value: string): string => value.match(legacyUuidPattern)?.[1] ?? value;

const collectLegacyUuids = (value: unknown, replacements: Map<string, string>): void => {
  if (typeof value === "string") {
    const repaired = repairLegacyUuid(value);
    if (repaired !== value) replacements.set(value, repaired);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectLegacyUuids(item, replacements));
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectLegacyUuids(item, replacements));
  }
};

const replaceLegacyUuids = (value: unknown, replacements: ReadonlyMap<string, string>): unknown => {
  if (typeof value === "string") return replacements.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceLegacyUuids(item, replacements));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, replaceLegacyUuids(item, replacements)])
  );
};

const getTables = (database: RejoDb): StoredTable[] => database.tables as unknown as StoredTable[];

export interface LegacyUuidRepairResult {
  replacements: ReadonlyMap<string, string>;
  repairedRecords: number;
}

export const repairLegacyUuidRecords = async (database: RejoDb): Promise<LegacyUuidRepairResult> => {
  const tables = getTables(database);
  const recordsByTable = await Promise.all(
    tables.map(async (table) => ({ table, records: await table.toArray() }))
  );
  const replacements = new Map<string, string>();

  recordsByTable.forEach(({ records }) => records.forEach((record) => collectLegacyUuids(record, replacements)));

  if (!replacements.size) return { replacements, repairedRecords: 0 };

  let repairedRecords = 0;
  await database.transaction("rw", tables, async () => {
    for (const { table, records } of recordsByTable) {
      for (const record of records) {
        const repaired = replaceLegacyUuids(record, replacements) as StoredRecord;
        const originalId = record.id;
        const repairedId = repaired.id;

        if (originalId !== repairedId) {
          await table.put(repaired);
          await table.delete(originalId as string);
          repairedRecords += 1;
          continue;
        }

        if (JSON.stringify(record) !== JSON.stringify(repaired)) {
          await table.put(repaired);
          repairedRecords += 1;
        }
      }
    }
  });

  return { replacements, repairedRecords };
};
