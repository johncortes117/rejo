import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { saveAnimalMock } = vi.hoisted(() => ({ saveAnimalMock: vi.fn() }));

vi.mock("@/features/animals/animals", () => ({
  archiveAnimal: vi.fn(),
  saveAnimal: saveAnimalMock
}));

import { NewAnimalWizard } from "@/features/animals/animals-browser-page";
import type { FarmSession, HerdGroup } from "@/domain/models";

const session: FarmSession = { farmId: "farm", userId: "user", role: "owner" };
const metadata = { farmId: "farm", createdAt: "2026-07-24T00:00:00.000Z", updatedAt: "2026-07-24T00:00:00.000Z", createdBy: "user" };
const groups: HerdGroup[] = [
  { ...metadata, id: "milking", name: "En ordeño", sortOrder: 0, isDefault: true },
  { ...metadata, id: "heifers", name: "Vaconas", sortOrder: 1, isDefault: true }
];

afterEach(() => {
  vi.clearAllMocks();
});

describe("NewAnimalWizard", () => {
  it("asks for the destination group before the animal details", () => {
    render(<NewAnimalWizard groups={groups} session={session} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "¿A qué grupo se integra?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Vaconas/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("heading", { name: "¿Cómo la conoces?" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ejemplo: Pintada")).toBeInTheDocument();
  });

  it("shows saving progress and ignores repeated taps on the final action", async () => {
    let resolveSave: (() => void) | undefined;
    saveAnimalMock.mockReturnValueOnce(new Promise<void>((resolve) => { resolveSave = resolve; }));
    const onSaved = vi.fn();
    render(<NewAnimalWizard groups={groups} session={session} onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole("button", { name: /Vaconas/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByPlaceholderText("Ejemplo: Pintada"), { target: { value: "Nube" } });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Partos antes de registrarla" }), { target: { value: "2" } });

    const saveButton = screen.getByRole("button", { name: "Agregar animal" });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(saveAnimalMock).toHaveBeenCalledTimes(1);
    expect(saveAnimalMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ previousCalvingCount: 2 }));
    expect(screen.getByRole("button", { name: "Guardando animal…" })).toBeDisabled();

    resolveSave?.();
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Nube quedó agregada a Vaconas."));
  });
});
