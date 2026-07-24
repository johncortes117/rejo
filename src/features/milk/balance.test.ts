import { describe, expect, it } from "vitest";
import { computeMilkBalance } from "@/features/milk/balance";

describe("computeMilkBalance", () => {
  it("flags only differences greater than three percent", () => {
    expect(computeMilkBalance(200, 206)).toMatchObject({ varianceLiters: 6, needsReview: false });
    expect(computeMilkBalance(200, 207)).toMatchObject({ varianceLiters: 7, needsReview: true });
  });
});
