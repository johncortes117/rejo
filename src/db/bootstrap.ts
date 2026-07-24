import { createUuidV7 } from "@/domain/ids";
import { FARM_TIMEZONE } from "@/domain/time";
import type { Farm, FarmSession } from "@/domain/models";
import { queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";

const SESSION_STORAGE_KEY = "rejo.farm-session";
const toPayload = (value: object): Record<string, unknown> =>
  value as Record<string, unknown>;

export const readFarmSession = (): FarmSession | null => {
  const value = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as FarmSession;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
};

export const saveFarmSession = (session: FarmSession): void => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

export interface ProvisionFarmInput {
  farmName: string;
  ownerName?: string;
  userId?: string;
}

export const provisionFarm = async (
  database: RejoDb,
  input: ProvisionFarmInput,
  now = new Date()
): Promise<FarmSession> => {
  const timestamp = now.toISOString();
  const farmId = createUuidV7(now.getTime());
  const userId = input.userId ?? createUuidV7(now.getTime() + 1);
  const farm: Farm = {
    id: farmId,
    farmId,
    name: input.farmName.trim(),
    ownerName: input.ownerName?.trim() || undefined,
    province: "Carchi",
    canton: "Montúfar",
    sector: "San Gabriel",
    timezone: FARM_TIMEZONE,
    brucellosisFree: false,
    bppCertified: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: userId
  };

  const buyerId = createUuidV7(now.getTime() + 2);
  const buyer = {
    id: buyerId,
    farmId,
    name: "Alpina",
    type: "industry" as const,
    paymentFrequency: "biweekly" as const,
    agreedPricePerLiter: 0.45,
    paysQualityBonus: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: userId
  };

  await database.transaction("rw", database.farms, database.buyers, database.syncQueue, async () => {
    await database.farms.put(farm);
    await database.buyers.put(buyer);
    await database.syncQueue.bulkPut([
      queueUpsert(farmId, "farms", farm.id, toPayload(farm), timestamp),
      queueUpsert(farmId, "buyers", buyer.id, toPayload(buyer), timestamp)
    ]);
  });

  const session: FarmSession = { farmId, userId, role: "admin" };
  saveFarmSession(session);
  return session;
};
