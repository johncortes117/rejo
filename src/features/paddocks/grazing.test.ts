import { describe, expect, it } from "vitest";
import { getPaddockDecisions } from "@/features/paddocks/grazing";
import type { GrazingRecord, Paddock } from "@/domain/models";

const meta = { farmId: "farm", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", createdBy: "user" };
const paddock = (id: string, targetRestDays = 21): Paddock => ({ id, ...meta, name: id, use: "pasture", targetRestDays });
const record = (id: string, paddockId: string, lotId: string, enteredAt: string, exitedAt?: string): GrazingRecord => ({ id, ...meta, paddockId, lotId, enteredAt, exitedAt });

describe("getPaddockDecisions", () => {
  it("prioritizes the current location and identifies a rested paddock", () => {
    const decisions = getPaddockDecisions([paddock("occupied"), paddock("ready")], [record("one", "occupied", "lot", "2026-07-20"), record("two", "ready", "lot", "2026-06-01", "2026-07-01")], "2026-07-24");
    expect(decisions.map((item) => item.state)).toEqual(["occupied", "ready"]);
    expect(decisions[1].detail).toContain("23 días");
  });

  it("shows remaining rest when the target has not been met", () => {
    const [decision] = getPaddockDecisions([paddock("resting", 30)], [record("one", "resting", "lot", "2026-07-01", "2026-07-10")], "2026-07-24");
    expect(decision.state).toBe("resting");
    expect(decision.detail).toContain("14 de 30");
  });
});
