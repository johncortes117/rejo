import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/rejo-db";
import { nowInFarmTimezone } from "@/domain/time";
import { MilkCapturePage } from "@/features/milk/milk-capture-page";

const session = { farmId: "farm", userId: "user", role: "owner" as const };
const metadata = { farmId: session.farmId, createdAt: "2026-07-20T12:00:00.000Z", updatedAt: "2026-07-20T12:00:00.000Z", createdBy: session.userId };

beforeEach(async () => {
  await Promise.all([db.tankReadings.clear(), db.milkUsages.clear(), db.syncQueue.clear()]);
});

afterEach(async () => {
  await Promise.all([db.tankReadings.clear(), db.milkUsages.clear(), db.syncQueue.clear()]);
});

describe("MilkCapturePage", () => {
  it("keeps the measurement date visible and accepts direct liters only", () => {
    render(<MilkCapturePage session={session} onSaved={vi.fn()} />);

    expect(screen.getByLabelText("Fecha de medida")).toHaveValue(nowInFarmTimezone().date);
    expect(screen.getByLabelText("Litros entregados")).toBeInTheDocument();
    expect(screen.queryByText("¿Cómo la mediste?")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regla" })).not.toBeInTheDocument();
  });

  it("opens saved measures and prepares one for correction", async () => {
    await db.tankReadings.put({ ...metadata, id: "farm-reading", date: "2026-07-20", time: "17:00", moment: "at_pickup", liters: 205, readBy: "farm" });
    await db.tankReadings.put({ ...metadata, id: "buyer-reading", date: "2026-07-20", time: "17:01", moment: "at_pickup", liters: 203, readBy: "buyer" });
    await db.milkUsages.put({ ...metadata, id: "calves", date: "2026-07-20", type: "calves", liters: 4 });
    render(<MilkCapturePage session={session} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Historial" }));

    expect(await screen.findByRole("heading", { name: "Historial de medidas" })).toBeInTheDocument();
    expect(await screen.findByText("205.0 L")).toBeInTheDocument();
    expect(screen.getByText("Tanquero: 203.0 L")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar medida del 2026-07-20" }));

    expect(screen.getByLabelText("Fecha de medida")).toHaveValue("2026-07-20");
    expect(screen.getByLabelText("Fecha de medida")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
  });
});
