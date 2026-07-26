import { createUuidV7 } from "@/domain/ids";
import type { Animal, HealthEvent, MilkControlRecord, MilkControlSession, PregnancyCheck, Service } from "@/domain/models";
import { queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";

export type ProductionBand = "high" | "medium" | "low";

export interface MilkControlSummary {
  session?: MilkControlSession;
  totalLiters: number;
  averageLiters?: number;
  bands: Record<string, ProductionBand>;
  trend?: "up" | "down" | "steady";
  priorTotalLiters?: number;
}

export interface HerdIndicators {
  activeAnimals: number;
  femaleAnimals: number;
  healthEventsIn30Days: number;
  servicesPerConfirmedPregnancy?: number;
  milk: MilkControlSummary;
}

export interface AnimalMilkTrendPoint {
  date: string;
  liters: number;
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const summarizeMilkControl = (sessions: MilkControlSession[], records: MilkControlRecord[]): MilkControlSummary => {
  const ordered = sessions.filter((item) => !item.deletedAt).sort((left, right) => right.date.localeCompare(left.date));
  const session = ordered[0];
  if (!session) return { totalLiters: 0, bands: {} };
  const current = records.filter((item) => !item.deletedAt && item.sessionId === session.id);
  const totalLiters = round(current.reduce((total, item) => total + item.liters, 0));
  const averageLiters = current.length ? round(totalLiters / current.length) : undefined;
  const bands = Object.fromEntries(current.map((item) => [item.animalId, !averageLiters || current.length < 3 ? "medium" : item.liters >= averageLiters * 1.15 ? "high" : item.liters <= averageLiters * 0.85 ? "low" : "medium"] as const));
  const previous = ordered[1];
  if (!previous) return { session, totalLiters, averageLiters, bands };
  const priorTotalLiters = round(records.filter((item) => !item.deletedAt && item.sessionId === previous.id).reduce((total, item) => total + item.liters, 0));
  const change = totalLiters - priorTotalLiters;
  return { session, totalLiters, averageLiters, bands, priorTotalLiters, trend: Math.abs(change) < 0.1 ? "steady" : change > 0 ? "up" : "down" };
};

export const buildAnimalMilkTrend = (
  animalId: string,
  sessions: MilkControlSession[],
  records: MilkControlRecord[]
): AnimalMilkTrendPoint[] => {
  const litersBySession = new Map<string, number>();

  records
    .filter((record) => !record.deletedAt && record.animalId === animalId)
    .forEach((record) => {
      litersBySession.set(record.sessionId, (litersBySession.get(record.sessionId) ?? 0) + record.liters);
    });

  return sessions
    .filter((session) => !session.deletedAt && litersBySession.has(session.id))
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((session) => ({ date: session.date, liters: round(litersBySession.get(session.id) ?? 0) }));
};

export const buildHerdIndicators = (input: { animals: Animal[]; sessions: MilkControlSession[]; records: MilkControlRecord[]; healthEvents: HealthEvent[]; services: Service[]; pregnancyChecks: PregnancyCheck[]; date: string }): HerdIndicators => {
  const activeAnimals = input.animals.filter((item) => !item.deletedAt && item.status === "active");
  const confirmedPregnancies = input.pregnancyChecks.filter((item) => !item.deletedAt && item.result === "pregnant").length;
  const thirtyDaysAgo = new Date(`${input.date}T00:00:00Z`);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  return { activeAnimals: activeAnimals.length, femaleAnimals: activeAnimals.filter((item) => item.sex !== "male").length, healthEventsIn30Days: input.healthEvents.filter((item) => !item.deletedAt && new Date(`${item.date}T00:00:00Z`) >= thirtyDaysAgo).length, servicesPerConfirmedPregnancy: confirmedPregnancies ? round(input.services.filter((item) => !item.deletedAt).length / confirmedPregnancies) : undefined, milk: summarizeMilkControl(input.sessions, input.records) };
};

export const recordMilkControl = async (database: RejoDb, input: { farmId: string; userId: string; date: string; notes?: string; readings: Array<{ animalId: string; liters: number }> }, now = new Date()): Promise<MilkControlSession> => {
  if (!input.date) throw new Error("Elige la fecha del control.");
  const readings = input.readings.filter((item) => Number.isFinite(item.liters));
  if (!readings.length) throw new Error("Anota al menos una producción individual.");
  if (readings.some((item) => item.liters < 0)) throw new Error("Los litros no pueden ser negativos.");
  const timestamp = now.toISOString();
  const session: MilkControlSession = { id: createUuidV7(now.getTime()), farmId: input.farmId, date: input.date, notes: input.notes?.trim() || undefined, createdAt: timestamp, updatedAt: timestamp, createdBy: input.userId };
  const records: MilkControlRecord[] = readings.map((item, index) => ({ id: createUuidV7(now.getTime() + index + 1), farmId: input.farmId, sessionId: session.id, animalId: item.animalId, liters: item.liters, createdAt: timestamp, updatedAt: timestamp, createdBy: input.userId }));
  await database.transaction("rw", database.milkControlSessions, database.milkControlRecords, database.syncQueue, async () => {
    await database.milkControlSessions.put(session);
    await database.milkControlRecords.bulkPut(records);
    await database.syncQueue.bulkPut([queueUpsert(input.farmId, "milk_control_sessions", session.id, session as unknown as Record<string, unknown>, timestamp), ...records.map((record) => queueUpsert(input.farmId, "milk_control_records", record.id, record as unknown as Record<string, unknown>, timestamp))]);
  });
  return session;
};
