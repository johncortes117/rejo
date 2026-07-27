import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimalAvatar } from "@/features/animals/animal-photo";

describe("AnimalAvatar", () => {
  it("shows only the photo when an animal has one", () => {
    render(<AnimalAvatar name="Andrea" photoUrl="data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%2F%3E" />);

    expect(screen.getByRole("img", { name: "Foto de Andrea" })).toBeInTheDocument();
    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Foto de Andrea" }).parentElement).toHaveClass("absolute");
    expect(screen.getByRole("img", { name: "Foto de Andrea" }).parentElement).not.toHaveClass("relative");
  });

  it("uses the initial when there is no photo", () => {
    render(<AnimalAvatar name="Andrea" />);

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Foto de Andrea" })).not.toBeInTheDocument();
  });
});
