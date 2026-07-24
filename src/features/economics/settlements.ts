import { createUuidV7 } from "@/domain/ids";
import type { Farm, MilkQualityTest, PriceSetting, Settlement } from "@/domain/models";
import { queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";
import { computeFairMilkPrice, type MilkQualityInput } from "@/features/economics/fair-price";

const toPayload = (value: object): Record<string, unknown> => value as Record<string, unknown>;

const defaultSettingValues = {
  historicalFloor: 0.42,
  fatBase: 3,
  fatStep: 0.2,
  fatPricePerStep: 0.0024,
  proteinBase: 2.9,
  proteinStep: 0.2,
  proteinPricePerStep: 0.0045,
  ufcBase: 158000,
  ufcStep: 20000,
  ufcPricePerStep: 0.0031,
  ccsBase: 250000,
  ccsStep: 15000,
  ccsPricePerStep: 0.003,
  brucellosisFreeBonus: 0.01,
  bppBonus: 0.01,
  sourceDocument: "Acuerdo Interministerial 024 (MPCEIP-MAG, 2024)"
};

export const ensureDefaultPriceSettings = async (database: RejoDb, farmId: string, userId: string, now = new Date()): Promise<PriceSetting[]> => {
  const existing = await database.priceSettings.filter((item) => item.farmId === farmId && !item.deletedAt).toArray();
  if (existing.length) return existing;
  const timestamp = now.toISOString();
  const settings: PriceSetting[] = [
    { id: createUuidV7(now.getTime()), farmId, effectiveFrom: "2024-05-20", supportPrice: 0.5, ...defaultSettingValues, createdAt: timestamp, updatedAt: timestamp, createdBy: userId },
    { id: createUuidV7(now.getTime() + 1), farmId, effectiveFrom: "2026-08-01", supportPrice: 0.5223, ...defaultSettingValues, createdAt: timestamp, updatedAt: timestamp, createdBy: userId }
  ];
  await database.transaction("rw", database.priceSettings, database.syncQueue, async () => {
    await database.priceSettings.bulkPut(settings);
    await database.syncQueue.bulkPut(settings.map((item) => queueUpsert(farmId, "price_settings", item.id, toPayload(item), timestamp)));
  });
  return settings;
};

export interface RecordSettlementInput {
  farmId: string;
  userId: string;
  buyerId: string;
  farm: Farm;
  periodStart: string;
  periodEnd: string;
  litersPaid: number;
  pricePerLiterPaid: number;
  totalPaid?: number;
  quality?: MilkQualityInput;
}

export const recordSettlement = async (database: RejoDb, input: RecordSettlementInput, now = new Date()): Promise<Settlement> => {
  if (!input.periodStart || !input.periodEnd || input.periodEnd < input.periodStart) throw new Error("Revisa las fechas de la liquidación.");
  if (!Number.isFinite(input.litersPaid) || input.litersPaid <= 0) throw new Error("Escribe los litros pagados.");
  if (!Number.isFinite(input.pricePerLiterPaid) || input.pricePerLiterPaid < 0) throw new Error("Escribe el precio pagado por litro.");

  const settings = await ensureDefaultPriceSettings(database, input.farmId, input.userId, now);
  const quality = input.quality ?? {};
  const hasQuality = Object.values(quality).some((value) => value !== undefined);
  const calculation = computeFairMilkPrice(input.periodEnd, quality, settings, { brucellosisFree: input.farm.brucellosisFree, bppCertified: input.farm.bppCertified });
  const timestamp = now.toISOString();
  const qualityTest: MilkQualityTest | undefined = hasQuality ? {
    id: createUuidV7(now.getTime() + 2), farmId: input.farmId, date: input.periodEnd, fatPct: quality.fatPct, proteinPct: quality.proteinPct, ufc: quality.ufc, ccs: quality.ccs, source: "buyer_reported", createdAt: timestamp, updatedAt: timestamp, createdBy: input.userId
  } : undefined;
  const buyerReadings = await database.tankReadings.filter((item) => item.farmId === input.farmId && !item.deletedAt && item.readBy === "buyer" && item.moment === "at_pickup" && item.date >= input.periodStart && item.date <= input.periodEnd).toArray();
  const measuredLiters = buyerReadings.reduce((total, item) => total + item.liters, 0);
  const varianceLiters = buyerReadings.length ? input.litersPaid - measuredLiters : undefined;
  const totalPaid = input.totalPaid ?? Math.round(input.litersPaid * input.pricePerLiterPaid * 100) / 100;
  const settlement: Settlement = {
    id: createUuidV7(now.getTime() + 3), farmId: input.farmId, buyerId: input.buyerId, periodStart: input.periodStart, periodEnd: input.periodEnd, litersPaid: input.litersPaid, pricePerLiterPaid: input.pricePerLiterPaid, totalPaid, qualityTestId: qualityTest?.id, reconciled: varianceLiters === undefined ? false : Math.abs(varianceLiters) < 0.1, varianceLiters, varianceAmount: Math.round((input.litersPaid * (calculation.price - input.pricePerLiterPaid)) * 100) / 100, legalPriceComputed: calculation.price, legalVariancePerLiter: Math.round((calculation.price - input.pricePerLiterPaid) * 10_000) / 10_000, createdAt: timestamp, updatedAt: timestamp, createdBy: input.userId
  };
  await database.transaction("rw", database.milkQualityTests, database.settlements, database.syncQueue, async () => {
    if (qualityTest) await database.milkQualityTests.put(qualityTest);
    await database.settlements.put(settlement);
    await database.syncQueue.bulkPut([
      ...(qualityTest ? [queueUpsert(input.farmId, "milk_quality_tests", qualityTest.id, toPayload(qualityTest), timestamp)] : []),
      queueUpsert(input.farmId, "settlements", settlement.id, toPayload(settlement), timestamp)
    ]);
  });
  return settlement;
};
