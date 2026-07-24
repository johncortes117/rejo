import { describe, expect, it } from "vitest";
import { computeFairMilkPrice } from "@/features/economics/fair-price";
import type { PriceSetting } from "@/domain/models";

const metadata = { farmId: "farm-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", createdBy: "user-1" };
const settings: PriceSetting[] = [
  { ...metadata, id: "price-2024", effectiveFrom: "2024-05-20", supportPrice: 0.5, historicalFloor: 0.42, fatBase: 3, fatStep: 0.2, fatPricePerStep: 0.0024, proteinBase: 2.9, proteinStep: 0.2, proteinPricePerStep: 0.0045, ufcBase: 158000, ufcStep: 20000, ufcPricePerStep: 0.0031, ccsBase: 250000, ccsStep: 15000, ccsPricePerStep: 0.003, brucellosisFreeBonus: 0.01, bppBonus: 0.01 },
  { ...metadata, id: "price-2026", effectiveFrom: "2026-08-01", supportPrice: 0.5223, historicalFloor: 0.42, fatBase: 3, fatStep: 0.2, fatPricePerStep: 0.0024, proteinBase: 2.9, proteinStep: 0.2, proteinPricePerStep: 0.0045, ufcBase: 158000, ufcStep: 20000, ufcPricePerStep: 0.0031, ccsBase: 250000, ccsStep: 15000, ccsPricePerStep: 0.003, brucellosisFreeBonus: 0.01, bppBonus: 0.01 }
];

describe("computeFairMilkPrice", () => {
  it("uses the reference price when all quality values are at the baseline", () => {
    expect(computeFairMilkPrice("2026-07-15", { fatPct: 3, proteinPct: 2.9, ufc: 158000, ccs: 250000 }, settings, { brucellosisFree: false, bppCertified: false }).price).toBe(0.5);
  });

  it("applies the published quality adjustments", () => {
    const result = computeFairMilkPrice("2026-07-15", { fatPct: 3.8, proteinPct: 3.1, ufc: 80000, ccs: 200000 }, settings, { brucellosisFree: false, bppCertified: false });
    expect(result).toMatchObject({ price: 0.5324, fatBonus: 0.0096, proteinBonus: 0.0045, ufcAdjustment: 0.0093, ccsAdjustment: 0.009 });
  });

  it("never goes below the historical legal floor", () => {
    expect(computeFairMilkPrice("2026-07-15", { fatPct: 0, proteinPct: 0, ufc: 2_000_000, ccs: 2_000_000 }, settings, { brucellosisFree: false, bppCertified: false }).price).toBe(0.42);
  });

  it("selects the version effective on the settlement date", () => {
    expect(computeFairMilkPrice("2026-07-15", {}, settings, { brucellosisFree: false, bppCertified: false }).price).toBe(0.5);
    expect(computeFairMilkPrice("2026-08-15", {}, settings, { brucellosisFree: false, bppCertified: false }).price).toBe(0.5223);
  });
});
