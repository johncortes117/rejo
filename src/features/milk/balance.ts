export interface MilkBalance {
  farmLiters?: number;
  buyerLiters?: number;
  varianceLiters?: number;
  variancePercent?: number;
  needsReview: boolean;
}

export const computeMilkBalance = (farmLiters?: number, buyerLiters?: number): MilkBalance => {
  if (farmLiters === undefined || buyerLiters === undefined || farmLiters <= 0) {
    return { farmLiters, buyerLiters, needsReview: false };
  }

  const varianceLiters = buyerLiters - farmLiters;
  const variancePercent = Math.abs(varianceLiters) / farmLiters * 100;
  return { farmLiters, buyerLiters, varianceLiters, variancePercent, needsReview: variancePercent > 3 };
};
