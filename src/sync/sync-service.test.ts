import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RejoDb } from "@/db/rejo-db";
import { queueUpsert } from "@/db/outbox";
import { syncPendingOperations } from "@/sync/sync-service";

const { fromMock, rpcMock, upsertMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  upsertMock: vi.fn()
}));

vi.mock("@/sync/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: fromMock,
    rpc: rpcMock
  }
}));

const farmId = "019f9aef-76ac-7d90-a164-e3ad73ee02ff";
const buyerId = "019f9af0-76ac-7d90-a164-e3ad73ee02ff";
const timestamp = "2026-07-25T18:00:00.000Z";

describe("syncPendingOperations", () => {
  let database: RejoDb;

  beforeEach(async () => {
    database = new RejoDb(`rejo-sync-${crypto.randomUUID()}`);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    rpcMock.mockResolvedValue({ error: null });
    upsertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert: upsertMock });

    await database.farms.put({
      id: farmId,
      farmId,
      name: "Finca La Esperanza",
      timezone: "America/Guayaquil",
      brucellosisFree: false,
      bppCertified: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: "019f9af1-76ac-7d90-a164-e3ad73ee02ff"
    });
    await database.syncQueue.put(
      queueUpsert(
        farmId,
        "buyers",
        buyerId,
        {
          id: buyerId,
          farmId,
          name: "Alpina",
          type: "industry",
          paysQualityBonus: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: "019f9af1-76ac-7d90-a164-e3ad73ee02ff"
        },
        timestamp
      )
    );
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await database.delete();
  });

  it("establishes remote farm access before syncing a dependent record", async () => {
    await expect(syncPendingOperations(database, farmId)).resolves.toEqual({
      state: "synced",
      processed: 1
    });

    expect(rpcMock).toHaveBeenCalledWith("bootstrap_farm", {
      p_farm_id: farmId,
      p_name: "Finca La Esperanza",
      p_owner_name: null,
      p_timezone: "America/Guayaquil",
      p_created_at: timestamp
    });
    expect(fromMock).toHaveBeenCalledWith("buyers");
    expect(rpcMock.mock.invocationCallOrder[0]).toBeLessThan(fromMock.mock.invocationCallOrder[0]);
    expect(await database.syncQueue.toArray()).toMatchObject([{ completedAt: expect.any(String) }]);
  });

  it("keeps the queue intact when remote farm access cannot be established", async () => {
    rpcMock.mockResolvedValue({ error: { message: "This account cannot access this farm." } });

    await expect(syncPendingOperations(database, farmId)).resolves.toEqual({
      state: "failed",
      processed: 0,
      error: "This account cannot access this farm."
    });

    expect(fromMock).not.toHaveBeenCalled();
    const [pendingItem] = await database.syncQueue.toArray();
    expect(pendingItem.completedAt).toBeUndefined();
    expect(pendingItem).toMatchObject({
      attemptCount: 1,
      lastError: "This account cannot access this farm."
    });
  });

  it("converts settlement buyerId to the buyer_id column before backup", async () => {
    await database.syncQueue.clear();
    await database.syncQueue.put(
      queueUpsert(
        farmId,
        "settlements",
        "019f9af2-76ac-7d90-a164-e3ad73ee02ff",
        {
          id: "019f9af2-76ac-7d90-a164-e3ad73ee02ff",
          farmId,
          buyerId,
          periodStart: "2026-07-01",
          periodEnd: "2026-07-15",
          litersPaid: 1000,
          pricePerLiterPaid: 0.45,
          totalPaid: 450,
          reconciled: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: "019f9af1-76ac-7d90-a164-e3ad73ee02ff"
        },
        timestamp
      )
    );

    await expect(syncPendingOperations(database, farmId)).resolves.toEqual({
      state: "synced",
      processed: 1
    });

    expect(fromMock).toHaveBeenCalledWith("settlements");
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ buyer_id: buyerId }), { onConflict: "id" });
    expect(upsertMock).toHaveBeenCalledWith(expect.not.objectContaining({ buyerId: expect.anything() }), { onConflict: "id" });
  });

  it("backs up an animal photo crop using the photo_crop column", async () => {
    await database.syncQueue.clear();
    await database.syncQueue.put(
      queueUpsert(
        farmId,
        "animals",
        "019f9af3-76ac-7d90-a164-e3ad73ee02ff",
        {
          id: "019f9af3-76ac-7d90-a164-e3ad73ee02ff",
          farmId,
          name: "Lucera",
          birthDateEstimated: false,
          photoUrl: "data:image/jpeg;base64,cGhvdG8=",
          photoCrop: { x: 45, y: 60, zoom: 1.2 },
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: "019f9af1-76ac-7d90-a164-e3ad73ee02ff"
        },
        timestamp
      )
    );

    await expect(syncPendingOperations(database, farmId)).resolves.toEqual({
      state: "synced",
      processed: 1
    });

    expect(fromMock).toHaveBeenCalledWith("animals");
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ photo_crop: { x: 45, y: 60, zoom: 1.2 } }), { onConflict: "id" });
  });
});
