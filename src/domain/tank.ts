export interface CalibrationPoint {
  mark: number;
  liters: number;
}

export interface TankInterpolation {
  liters: number;
  extrapolated: boolean;
}

const sortPoints = (points: CalibrationPoint[]): CalibrationPoint[] =>
  [...points].sort((left, right) => left.mark - right.mark);

export const validateCalibrationPoints = (points: CalibrationPoint[]): string | null => {
  const sorted = sortPoints(points);

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];

    if (current.mark === previous.mark) {
      return "Cada marca debe aparecer una sola vez.";
    }

    if (current.liters <= previous.liters) {
      return "Los litros deben aumentar cuando aumenta la marca.";
    }
  }

  return null;
};

export const interpolateTankLiters = (
  mark: number,
  calibrationTable: CalibrationPoint[]
): TankInterpolation | null => {
  const points = sortPoints(calibrationTable);

  if (points.length === 0) {
    return null;
  }

  if (mark <= points[0].mark) {
    return { liters: mark === points[0].mark ? points[0].liters : 0, extrapolated: false };
  }

  const lastPoint = points.at(-1);
  if (!lastPoint) {
    return null;
  }

  let lower = points[0];
  let upper = lastPoint;
  const extrapolated = mark > lastPoint.mark;

  if (extrapolated) {
    lower = points.at(-2) ?? points[0];
  } else {
    for (let index = 1; index < points.length; index += 1) {
      if (mark <= points[index].mark) {
        lower = points[index - 1];
        upper = points[index];
        break;
      }
    }
  }

  const markRange = upper.mark - lower.mark;
  if (markRange === 0) {
    return null;
  }

  const liters = lower.liters + ((mark - lower.mark) / markRange) * (upper.liters - lower.liters);

  return {
    liters: Math.round(liters * 10) / 10,
    extrapolated
  };
};
