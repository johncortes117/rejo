import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewAnimalWizard } from "@/features/animals/animals-browser-page";
import type { FarmSession, HerdGroup } from "@/domain/models";

const session: FarmSession = { farmId: "farm", userId: "user", role: "owner" };
const metadata = { farmId: "farm", createdAt: "2026-07-24T00:00:00.000Z", updatedAt: "2026-07-24T00:00:00.000Z", createdBy: "user" };
const groups: HerdGroup[] = [
  { ...metadata, id: "milking", name: "En ordeño", sortOrder: 0, isDefault: true },
  { ...metadata, id: "heifers", name: "Vaconas", sortOrder: 1, isDefault: true }
];

describe("NewAnimalWizard", () => {
  it("asks for the destination group before the animal details", () => {
    render(<NewAnimalWizard groups={groups} session={session} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "¿A qué grupo se integra?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Vaconas/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("heading", { name: "¿Cómo la conoces?" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ejemplo: Pintada")).toBeInTheDocument();
  });
});
