import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { db } from "@/db/rejo-db";
import type { Animal, FarmSession, HerdGroup } from "@/domain/models";
import { AnimalDetail } from "@/features/animals/animals-page";

const session: FarmSession = { farmId: "farm", userId: "user", role: "owner" };
const metadata = { farmId: "farm", createdAt: "2026-07-25T00:00:00.000Z", updatedAt: "2026-07-25T00:00:00.000Z", createdBy: "user" };
const group: HerdGroup = { ...metadata, id: "milking", name: "En ordeño", sortOrder: 0, isDefault: true };
const animal: Animal = { ...metadata, id: "bella", name: "Bella", sex: "female", birthDate: "2021-07-25", birthDateEstimated: true, photoUrl: "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%2F%3E", herdGroupId: group.id, previousCalvingCount: 2, status: "active" };

const clearDatabase = async () => {
  await Promise.all([
    db.heats.clear(),
    db.services.clear(),
    db.pregnancyChecks.clear(),
    db.calvings.clear(),
    db.dryOffs.clear(),
    db.healthEvents.clear(),
    db.healthPlanTasks.clear(),
    db.milkControlSessions.clear(),
    db.milkControlRecords.clear()
  ]);
};

beforeEach(async () => {
  await clearDatabase();
  await db.milkControlSessions.bulkPut([
    { ...metadata, id: "control-1", date: "2026-07-01" },
    { ...metadata, id: "control-2", date: "2026-07-15" }
  ]);
  await db.milkControlRecords.bulkPut([
    { ...metadata, id: "reading-1", sessionId: "control-1", animalId: animal.id, liters: 10 },
    { ...metadata, id: "reading-2", sessionId: "control-2", animalId: animal.id, liters: 12.5 }
  ]);
  await db.heats.put({ ...metadata, id: "heat-1", animalId: animal.id, date: "2026-07-20", served: false });
});

afterEach(async () => {
  await clearDatabase();
  document.body.style.overflow = "";
  document.body.style.overscrollBehavior = "";
});

describe("AnimalDetail", () => {
  it("uses the animal photo as the profile hero and shows individual milk trend", async () => {
    const { unmount } = render(<AnimalDetail animal={animal} groups={[group]} session={session} onClose={vi.fn()} onEdit={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Bella" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Foto de Bella" })).toBeInTheDocument();
    const hero = screen.getByTestId("animal-profile-hero");
    expect(hero).not.toHaveClass("h-52");
    expect(hero).toHaveTextContent("Bella");
    expect(hero).not.toHaveTextContent("En ordeño");
    expect(hero).not.toHaveTextContent("Hembra");
    expect(screen.getByRole("dialog")).toHaveClass("z-[100]");
    expect(await screen.findByText("12.5 L")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Tendencia de producción de Bella/i })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps the reproductive form hidden until the farmer chooses to register an event", async () => {
    render(<AnimalDetail animal={animal} groups={[group]} session={session} onClose={vi.fn()} onEdit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reproducción" }));
    expect(await screen.findByText("Celo detectado")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "¿Qué ocurrió?" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Registrar evento" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "¿Qué ocurrió?" })).toBeInTheDocument());
  });
});
