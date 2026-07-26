import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { pullFarmChangesMock, syncPendingOperationsMock, supabaseMock } = vi.hoisted(() => ({
  pullFarmChangesMock: vi.fn(),
  syncPendingOperationsMock: vi.fn(),
  supabaseMock: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn()
    }
  }
}));

vi.mock("@/sync/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: supabaseMock
}));

vi.mock("@/sync/sync-service", () => ({
  pullFarmChanges: pullFarmChangesMock,
  syncPendingOperations: syncPendingOperationsMock
}));

import { App } from "@/app/app";
import { readFarmSession, saveFarmSession } from "@/db/bootstrap";
import { db } from "@/db/rejo-db";
import { queueUpsert } from "@/db/outbox";

const clearDatabase = async () => {
  await Promise.all([
    db.farms.clear(),
    db.buyers.clear(),
    db.tankCalibrations.clear(),
    db.animals.clear(),
    db.tankReadings.clear(),
    db.milkUsages.clear(),
    db.heats.clear(),
    db.services.clear(),
    db.pregnancyChecks.clear(),
    db.calvings.clear(),
    db.dryOffs.clear(),
    db.healthEvents.clear(),
    db.healthPlanTasks.clear(),
    db.herdGroups.clear(),
    db.milkQualityTests.clear(),
    db.priceSettings.clear(),
    db.settlements.clear(),
    db.transactions.clear(),
    db.assets.clear(),
    db.labor.clear(),
    db.paddocks.clear(),
    db.grazingLots.clear(),
    db.grazingRecords.clear(),
    db.milkControlSessions.clear(),
    db.milkControlRecords.clear(),
    db.syncQueue.clear()
  ]);
};

beforeEach(async () => {
  localStorage.clear();
  await clearDatabase();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  supabaseMock.auth.getSession.mockResolvedValue({ data: { session: { user: { id: "user" } } } });
  supabaseMock.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  saveFarmSession({ farmId: "farm", userId: "user", role: "owner" });
  await db.syncQueue.put(queueUpsert("farm", "animals", "animal", { id: "animal", farmId: "farm" }, "2026-07-25T18:00:00.000Z"));
});

afterEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  await clearDatabase();
});

describe("backup feedback", () => {
  it("shows that pending records are actively being backed up", async () => {
    syncPendingOperationsMock.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    expect(await screen.findByRole("button", { name: "Respaldando 1 cambio" })).toBeDisabled();
  });

  it("explains a failed backup without suggesting that local records were lost", async () => {
    syncPendingOperationsMock.mockResolvedValue({ state: "failed", processed: 0, error: "fetch failed" });

    render(<App />);

    expect(await screen.findByText(/Tu 1 cambio sigue guardado en este celular\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar respaldo de 1 cambio" })).toBeEnabled();
  });

  it("confirms when all pending records reach the cloud", async () => {
    syncPendingOperationsMock.mockImplementation(async () => {
      await db.syncQueue.clear();
      return { state: "synced", processed: 1 };
    });

    render(<App />);

    expect(await screen.findByText("1 cambio quedó respaldado en la nube.")).toBeInTheDocument();
    expect(screen.getByLabelText("Respaldo al día")).toBeInTheDocument();
  });

  it("repairs legacy identifiers before starting an automatic backup", async () => {
    const malformedFarmId = "019f9a97-6180-7a7f-95da-8c50993129f02";
    const repairedFarmId = "019f9a97-6180-7a7f-95da-8c50993129f0";
    const malformedAnimalId = "019f9a97-6181-7a7f-95da-8c50993129f03";

    await clearDatabase();
    localStorage.clear();
    saveFarmSession({ farmId: malformedFarmId, userId: "user", role: "owner" });
    await db.syncQueue.put(queueUpsert(malformedFarmId, "animals", malformedAnimalId, {
      id: malformedAnimalId,
      farmId: malformedFarmId
    }, "2026-07-25T18:00:00.000Z"));
    syncPendingOperationsMock.mockResolvedValue({ state: "synced", processed: 1 });

    render(<App />);

    await waitFor(() =>
      expect(syncPendingOperationsMock).toHaveBeenCalledWith(db, repairedFarmId)
    );
    expect(readFarmSession()?.farmId).toBe(repairedFarmId);
    expect((await db.syncQueue.toArray())[0]).toMatchObject({
      farmId: repairedFarmId,
      entityId: "019f9a97-6181-7a7f-95da-8c50993129f0"
    });
  });
});
