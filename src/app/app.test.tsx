import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/sync/supabase", () => ({
  isSupabaseConfigured: false,
  supabase: null
}));

import { App } from "@/app/app";
import { db } from "@/db/rejo-db";

const clearDatabase = async () => {
  await Promise.all([
    db.farms.clear(),
    db.buyers.clear(),
    db.tankCalibrations.clear(),
    db.animals.clear(),
    db.tankReadings.clear(),
    db.milkUsages.clear(),
    db.syncQueue.clear()
  ]);
};

beforeEach(async () => {
  localStorage.clear();
  await clearDatabase();
});

afterEach(async () => {
  localStorage.clear();
  await clearDatabase();
});

describe("Phase 0 daily flow", () => {
  it("provisions a local farm and records a tank measurement while offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Finca El Capulí"), {
      target: { value: "Finca La Pintada" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    await screen.findByRole("heading", { name: "La finca, al día." });
    fireEvent.click(screen.getByRole("button", { name: "Anotar la leche" }));
    fireEvent.change(screen.getByPlaceholderText("Ejemplo: 205"), { target: { value: "205" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar la medida" }));

    await waitFor(() =>
      expect(screen.getByText("205.0")).toBeInTheDocument()
    );
    expect(await db.tankReadings.count()).toBe(1);
    expect(await db.syncQueue.count()).toBeGreaterThanOrEqual(3);
  });
});
