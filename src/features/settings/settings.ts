import type { Buyer, Farm } from "@/domain/models";
import { queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";

const toPayload = (value: object): Record<string, unknown> =>
  value as Record<string, unknown>;

export interface SaveFarmSettingsInput {
  farm: Farm;
  buyer: Buyer;
}

export const saveFarmSettings = async (
  database: RejoDb,
  input: SaveFarmSettingsInput,
  now = new Date()
): Promise<void> => {
  const timestamp = now.toISOString();
  const farm = { ...input.farm, updatedAt: timestamp };
  const buyer = { ...input.buyer, updatedAt: timestamp };

  await database.transaction(
    "rw",
    database.farms,
    database.buyers,
    database.syncQueue,
    async () => {
      await database.farms.put(farm);
      await database.buyers.put(buyer);

      await database.syncQueue.bulkPut([
        queueUpsert(farm.id, "farms", farm.id, toPayload(farm), timestamp),
        queueUpsert(farm.id, "buyers", buyer.id, toPayload(buyer), timestamp)
      ]);
    }
  );
};
