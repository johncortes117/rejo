import type { PriceSetting } from "@/domain/models";

export interface MilkQualityInput {
  fatPct?: number;
  proteinPct?: number;
  ufc?: number;
  ccs?: number;
}

export interface FarmCertifications {
  brucellosisFree: boolean;
  bppCertified: boolean;
}

export interface FairPriceBreakdown {
  price: number;
  setting: PriceSetting;
  fatBonus: number;
  proteinBonus: number;
  ufcAdjustment: number;
  ccsAdjustment: number;
  certificationBonus: number;
}

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 10_000) / 10_000;

const selectSetting = (settings: PriceSetting[], date: string): PriceSetting => {
  const setting = settings
    .filter((item) => !item.deletedAt && item.effectiveFrom <= date)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];
  if (!setting) throw new Error("No hay un precio legal configurado para esta fecha.");
  return setting;
};

const stepsFromBase = (value: number, base: number, step: number): number => {
  const rawSteps = (value - base) / step;
  const nearestInteger = Math.round(rawSteps);
  return Math.abs(rawSteps - nearestInteger) < 1e-9 ? nearestInteger : Math.trunc(rawSteps);
};

export const computeFairMilkPrice = (
  date: string,
  quality: MilkQualityInput,
  settings: PriceSetting[],
  certifications: FarmCertifications
): FairPriceBreakdown => {
  const setting = selectSetting(settings, date);
  const fatBonus = quality.fatPct === undefined ? 0 : stepsFromBase(quality.fatPct, setting.fatBase, setting.fatStep) * setting.fatPricePerStep;
  const proteinBonus = quality.proteinPct === undefined ? 0 : stepsFromBase(quality.proteinPct, setting.proteinBase, setting.proteinStep) * setting.proteinPricePerStep;
  const ufcAdjustment = quality.ufc === undefined ? 0 : -stepsFromBase(quality.ufc, setting.ufcBase, setting.ufcStep) * setting.ufcPricePerStep;
  const ccsAdjustment = quality.ccs === undefined ? 0 : -stepsFromBase(quality.ccs, setting.ccsBase, setting.ccsStep) * setting.ccsPricePerStep;
  const certificationBonus = (certifications.brucellosisFree ? setting.brucellosisFreeBonus : 0) + (certifications.bppCertified ? setting.bppBonus : 0);
  return {
    price: roundMoney(Math.max(setting.historicalFloor, setting.supportPrice + fatBonus + proteinBonus + ufcAdjustment + ccsAdjustment + certificationBonus)),
    setting,
    fatBonus: roundMoney(fatBonus),
    proteinBonus: roundMoney(proteinBonus),
    ufcAdjustment: roundMoney(ufcAdjustment),
    ccsAdjustment: roundMoney(ccsAdjustment),
    certificationBonus: roundMoney(certificationBonus)
  };
};
