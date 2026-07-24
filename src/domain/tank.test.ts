import { describe, expect, it } from "vitest";
import { interpolateTankLiters, validateCalibrationPoints } from "@/domain/tank";

describe("interpolateTankLiters", () => {
  const table = [
    { mark: 10, liters: 100 },
    { mark: 20, liters: 200 },
    { mark: 30, liters: 300 }
  ];

  it("returns an exact calibration point", () => {
    expect(interpolateTankLiters(20, table)).toEqual({ liters: 200, extrapolated: false });
  });

  it("interpolates between calibration points", () => {
    expect(interpolateTankLiters(15, table)).toEqual({ liters: 150, extrapolated: false });
  });

  it("returns zero below the minimum mark", () => {
    expect(interpolateTankLiters(5, table)).toEqual({ liters: 0, extrapolated: false });
  });

  it("extrapolates above the maximum mark with a warning flag", () => {
    expect(interpolateTankLiters(35, table)).toEqual({ liters: 350, extrapolated: true });
  });

  it("returns null for an empty calibration table", () => {
    expect(interpolateTankLiters(20, [])).toBeNull();
  });
});

describe("validateCalibrationPoints", () => {
  it("rejects liters that do not increase with the mark", () => {
    expect(
      validateCalibrationPoints([
        { mark: 10, liters: 100 },
        { mark: 20, liters: 100 }
      ])
    ).toBe("Los litros deben aumentar cuando aumenta la marca.");
  });
});
