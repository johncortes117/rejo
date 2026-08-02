import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@/sync/supabase", () => ({
  isSupabaseConfigured: false,
  supabase: null
}));

import { App } from "@/app/app";
import { db } from "@/db/rejo-db";
import { nowInFarmTimezone } from "@/domain/time";

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
    fireEvent.click(screen.getByRole("button", { name: "Anotar" }));
    fireEvent.change(screen.getByLabelText("Litros entregados"), { target: { value: "205" } });
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
    await screen.findByText("Todo en orden · sin alertas para hoy.");

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

    await screen.findByRole("heading", { name: "Potreros" });
    fireEvent.click(screen.getByRole("button", { name: "Volver al inicio" }));
    await screen.findByRole("heading", { name: "La finca, al día." });
  });

  it("keeps the home screen concise when cloud backup is unavailable", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Finca El Capulí"), {
      target: { value: "Finca La Pintada" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    await screen.findByRole("heading", { name: "La finca, al día." });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Respaldar" })).not.toBeInTheDocument();
    expect(screen.queryByText("Empieza por lo que pasó hoy; el resto está a un toque.")).not.toBeInTheDocument();
    expect(screen.queryByText("Tendencia de leche")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anotar" })).toBeInTheDocument();
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

  it("keeps reproduction focused on pending animals before showing the full rejo", async () => {
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

    const [farm] = await db.farms.toArray();
    const timestamp = "2026-07-24T12:00:00.000Z";
    await db.animals.bulkPut([
      { id: "reproduction-estrella", farmId: farm.id, name: "Estrella", sex: "female", birthDateEstimated: true, status: "active", createdAt: timestamp, updatedAt: timestamp, createdBy: farm.createdBy },
      { id: "reproduction-canela", farmId: farm.id, name: "Canela", sex: "female", birthDateEstimated: true, status: "active", createdAt: timestamp, updatedAt: timestamp, createdBy: farm.createdBy },
      { id: "reproduction-luna", farmId: farm.id, name: "Luna", sex: "female", birthDateEstimated: true, status: "active", createdAt: timestamp, updatedAt: timestamp, createdBy: farm.createdBy }
    ]);
    await db.heats.put({ id: "heat-estrella", farmId: farm.id, animalId: "reproduction-estrella", date: "2026-07-24", served: false, createdAt: timestamp, updatedAt: timestamp, createdBy: farm.createdBy });
    await db.services.put({ id: "service-canela", farmId: farm.id, animalId: "reproduction-canela", date: "2026-06-01", type: "ai", serviceNumber: 1, createdAt: timestamp, updatedAt: timestamp, createdBy: farm.createdBy });

    await screen.findByText("2 animales por revisar");
    expect(screen.queryByText("Primero mira qué animales requieren atención; después abre su ficha para registrar el evento.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver 2 pendientes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Luna")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver las 3 vacas" }));
    await screen.findByText("Luna");
    expect(screen.getByRole("button", { name: "Ver las 3 vacas" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Ver 2 pendientes" }));
    await waitFor(() => expect(screen.queryByText("Luna")).not.toBeInTheDocument());
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

  it("organizes animals by group and finds an animal across the rejo", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Finca El Capulí"), {
      target: { value: "Finca La Pintada" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    await screen.findByRole("heading", { name: "La finca, al día." });
    fireEvent.click(screen.getByRole("button", { name: "Rejo" }));
    await screen.findByRole("heading", { name: "El rejo" });
    fireEvent.click(screen.getByRole("button", { name: /^Animales\b/ }));
    await screen.findByRole("heading", { name: "Animales" });
    await waitFor(async () => expect(await db.herdGroups.count()).toBe(4));

    const [farm] = await db.farms.toArray();
    const groups = await db.herdGroups.toArray();
    const milkingGroup = groups.find((group) => group.name === "En ordeño");
    const heiferGroup = groups.find((group) => group.name === "Vaconas");
    const timestamp = "2026-07-24T12:00:00.000Z";
    await db.animals.bulkPut([
      { id: "animal-lucero", farmId: farm.id, name: "Lucero", sex: "female", birthDateEstimated: true, photoUrl: "data:image/jpeg;base64,cGhvdG8=", herdGroupId: milkingGroup?.id, status: "active", createdAt: timestamp, updatedAt: timestamp, createdBy: farm.createdBy },
      { id: "animal-nube", farmId: farm.id, name: "Nube", sex: "female", birthDateEstimated: true, herdGroupId: heiferGroup?.id, status: "active", createdAt: timestamp, updatedAt: timestamp, createdBy: farm.createdBy }
    ]);

    await screen.findByRole("button", { name: /En ordeño 1/ });
    fireEvent.click(screen.getByRole("button", { name: /Vaconas 1/ }));
    await screen.findByText("Nube");
    expect(screen.queryByText("Lucero")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Buscar animal" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar por nombre" }), { target: { value: "Lucero" } });
    await screen.findByText("Lucero");
    const luceroRow = screen.getByRole("button", { name: "Abrir ficha de Lucero" });
    expect(within(luceroRow).getByText("En ordeño")).toBeInTheDocument();
    expect(within(luceroRow).queryByText("Hembra")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Foto de Lucero" })).toHaveAttribute("src", "data:image/jpeg;base64,cGhvdG8=");
  });

  it("puts milk withdrawal before health plan tasks and resolves a task in a focused view", async () => {
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

    const [farm] = await db.farms.toArray();
    const timestamp = "2026-07-24T12:00:00.000Z";
    const today = nowInFarmTimezone().date;
    const [year, month, day] = today.split("-").map(Number);
    const nextWeek = new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10);
    await db.animals.put({ id: "health-luna", farmId: farm.id, name: "Luna", sex: "female", birthDateEstimated: true, status: "active", createdAt: timestamp, updatedAt: timestamp, createdBy: farm.createdBy });
    await db.healthEvents.put({ id: "health-luna-treatment", farmId: farm.id, animalId: "health-luna", date: today, type: "mastitis", milkWithdrawalHours: 72, createdAt: timestamp, updatedAt: timestamp, createdBy: farm.createdBy });
    await db.healthPlanTasks.put({ id: "health-curada", farmId: farm.id, category: "cow", taskType: "deworming", dueDate: today, isTemplate: false, createdAt: timestamp, updatedAt: timestamp, createdBy: farm.createdBy });

    await screen.findByText("1 vaca con leche en retiro");
    expect(screen.queryByText("Revisa primero la leche en retiro y las tareas pendientes; el tratamiento de cada vaca sigue en su ficha.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir ficha de Luna: no entregar leche" })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Gestionar Curada" }));
    await screen.findByRole("dialog", { name: "Gestionar Curada" });
    expect(screen.getByRole("heading", { name: "¿Qué pasó con esta tarea?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Posponer 7 días" }));

    await waitFor(async () => expect((await db.healthPlanTasks.get("health-curada"))?.dueDate).toBe(nextWeek));
    await screen.findByText("La tarea se pospuso siete días.");
    expect(screen.queryByRole("dialog", { name: "Gestionar Curada" })).not.toBeInTheDocument();
  });

  it("opens milk control as a focused capture journey", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Finca El Capulí"), {
      target: { value: "Finca La Pintada" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    await screen.findByRole("heading", { name: "La finca, al día." });
    fireEvent.click(screen.getByRole("button", { name: "Abrir control lechero" }));
    await screen.findByRole("heading", { name: "Control lechero" });
    await waitFor(async () => expect(await db.herdGroups.count()).toBe(4));
    const [farm] = await db.farms.toArray();
    const groups = await db.herdGroups.toArray();
    const milkingGroup = groups.find((group) => group.name === "En ordeño");
    const heiferGroup = groups.find((group) => group.name === "Vaconas");
    const timestamp = "2026-07-24T12:00:00.000Z";
    await db.animals.bulkPut([
      { id: "milk-control-lucero", farmId: farm.id, name: "Lucero", sex: "female", birthDateEstimated: true, herdGroupId: milkingGroup?.id, status: "active", createdAt: timestamp, updatedAt: timestamp, createdBy: farm.createdBy },
      { id: "milk-control-ternera", farmId: farm.id, name: "Ternera", sex: "female", birthDateEstimated: true, herdGroupId: heiferGroup?.id, status: "active", createdAt: timestamp, updatedAt: timestamp, createdBy: farm.createdBy }
    ]);

    expect(screen.queryByRole("dialog", { name: "Registrar control lechero" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empezar control" }));

    await screen.findByRole("dialog", { name: "Registrar control lechero" });
    expect(await screen.findByRole("button", { name: /En ordeño/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(await screen.findByRole("spinbutton", { name: "Litros de Lucero" }), { target: { value: "12.5" } });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    fireEvent.click(screen.getByRole("button", { name: "Guardar 1 lectura" }));

    await waitFor(async () => expect(await db.milkControlRecords.count()).toBe(1));
    expect((await db.milkControlRecords.toArray())[0]).toMatchObject({ animalId: "milk-control-lucero", liters: 12.5 });
    await screen.findByText("El control lechero quedó guardado en el celular.");
    expect(screen.queryByRole("dialog", { name: "Registrar control lechero" })).not.toBeInTheDocument();
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

    await screen.findByRole("heading", { name: "Configuración" });
    expect(screen.queryByText("Plan sanitario mínimo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tabla de aforo" })).not.toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "Caja de la finca" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 días" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Resultado de caja")).toBeInTheDocument();
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

  it("opens the herd movement workflow from the paddock overview", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Finca El Capulí"), {
      target: { value: "Finca La Pintada" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    await screen.findByRole("heading", { name: "La finca, al día." });
    fireEvent.click(screen.getByRole("button", { name: "Más" }));
    await screen.findByRole("heading", { name: "Más" });
    fireEvent.click(screen.getByRole("button", { name: /Potreros/ }));
    await screen.findByRole("heading", { name: "Potreros" });
    expect(screen.queryByRole("heading", { name: "Mover el rejo" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mover el rejo" }));
    await screen.findByRole("heading", { name: "Mover el rejo" });
  });
});
