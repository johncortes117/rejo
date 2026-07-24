import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

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

  it("opens the four operational destinations from the mobile navigation", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Finca El Capulí"), {
      target: { value: "Finca La Pintada" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    await screen.findByRole("heading", { name: "La finca, al día." });
    await screen.findByText("No hay alertas que requieran atención hoy.");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Rejo" }));
    });
    await screen.findByRole("heading", { name: "El rejo" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Más" }));
    });
    await screen.findByRole("heading", { name: "Más" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Finanzas" }));
    });
    await screen.findByRole("heading", { name: "Finanzas" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Inicio" }));
    });
    await screen.findByRole("heading", { name: "La finca, al día." });
  });

  it("opens a frequent farm action from the today dashboard", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Finca El Capulí"), {
      target: { value: "Finca La Pintada" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    await screen.findByRole("heading", { name: "La finca, al día." });
    fireEvent.click(screen.getByRole("button", { name: "Abrir potreros" }));

    await screen.findByRole("heading", { name: "Potreros y rotación" });
    fireEvent.click(screen.getByRole("button", { name: "Volver al inicio" }));
    await screen.findByRole("heading", { name: "La finca, al día." });
  });

  it("opens the global reproduction worklist from the herd hub", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Finca El Capulí"), {
      target: { value: "Finca La Pintada" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    await screen.findByRole("heading", { name: "La finca, al día." });
    fireEvent.click(screen.getByRole("button", { name: "Rejo" }));
    await screen.findByRole("heading", { name: "El rejo" });
    fireEvent.click(screen.getByRole("button", { name: /Reproducción/ }));

    await screen.findByRole("heading", { name: "Reproducción" });
  });

  it("opens the global health worklist from the herd hub", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Finca El Capulí"), {
      target: { value: "Finca La Pintada" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    await screen.findByRole("heading", { name: "La finca, al día." });
    fireEvent.click(screen.getByRole("button", { name: "Rejo" }));
    await screen.findByRole("heading", { name: "El rejo" });
    fireEvent.click(screen.getByRole("button", { name: /Sanidad/ }));

    await screen.findByRole("heading", { name: "Sanidad" });
  });

  it("keeps operational health out of farm settings", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Finca El Capulí"), {
      target: { value: "Finca La Pintada" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    await screen.findByRole("heading", { name: "La finca, al día." });
    fireEvent.click(screen.getByRole("button", { name: "Más" }));
    await screen.findByRole("heading", { name: "Más" });
    fireEvent.click(screen.getByRole("button", { name: /Configuración/ }));

    await screen.findByRole("heading", { name: "Configuración de la finca" });
    expect(screen.queryByText("Plan sanitario mínimo")).not.toBeInTheDocument();
  });

  it("opens finances as a summary before opening a settlement form", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Finca El Capulí"), {
      target: { value: "Finca La Pintada" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    await screen.findByRole("heading", { name: "La finca, al día." });
    fireEvent.click(screen.getByRole("button", { name: "Finanzas" }));

    await screen.findByRole("heading", { name: "Finanzas" });
    expect(screen.queryByRole("heading", { name: "Registrar liquidación" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Liquidaciones" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar liquidación" }));

    await screen.findByRole("heading", { name: "Registrar liquidación" });
  });

  it("records a financial movement locally from its dedicated entry", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Finca El Capulí"), {
      target: { value: "Finca La Pintada" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    await screen.findByRole("heading", { name: "La finca, al día." });
    fireEvent.click(screen.getByRole("button", { name: "Finanzas" }));
    await screen.findByRole("heading", { name: "Finanzas" });
    fireEvent.click(screen.getByRole("button", { name: "Movimientos" }));
    await screen.findByRole("heading", { name: "Movimientos" });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await screen.findByRole("heading", { name: "Registrar movimiento" });

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Molido, medicamento o combustible"), { target: { value: "Concentrado" } });
    fireEvent.change(screen.getByPlaceholderText("Ejemplo: 35.50"), { target: { value: "35.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar movimiento" }));

    await waitFor(async () => expect(await db.transactions.count()).toBe(1));
    expect((await db.transactions.toArray())[0]).toMatchObject({ category: "Concentrado", amount: 35.5, direction: "expense" });
  });
});
