import type { MilkUsage, TankReading } from "@/domain/models";

export interface MilkHistoryEntry {
  date: string;
  liters: number;
  buyerLiters?: number;
  calvesLiters?: number;
}

const latestReading = (readings: TankReading[]): TankReading | undefined =>
  readings.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

export const buildMilkHistory = (readings: TankReading[], usages: MilkUsage[]): MilkHistoryEntry[] => {
  const activeReadings = readings.filter((reading) => !reading.deletedAt && reading.moment === "at_pickup");
  const farmReadingsByDate = new Map<string, TankReading[]>();
  const buyerReadingsByDate = new Map<string, TankReading[]>();

  for (const reading of activeReadings) {
    const readingsByDate = reading.readBy === "farm" ? farmReadingsByDate : buyerReadingsByDate;
    readingsByDate.set(reading.date, [...(readingsByDate.get(reading.date) ?? []), reading]);
  }

  const calvesByDate = new Map<string, number>();
  for (const usage of usages.filter((usage) => !usage.deletedAt && usage.type === "calves")) {
    calvesByDate.set(usage.date, (calvesByDate.get(usage.date) ?? 0) + usage.liters);
  }

  return [...farmReadingsByDate.entries()]
    .map(([date, dateReadings]) => {
      const farmReading = latestReading(dateReadings)!;
      const buyerReading = latestReading(buyerReadingsByDate.get(date) ?? []);
      const calvesLiters = calvesByDate.get(date);
      return {
        date,
        liters: farmReading.liters,
        buyerLiters: buyerReading?.liters,
        calvesLiters: calvesLiters && calvesLiters > 0 ? Math.round(calvesLiters * 10) / 10 : undefined
      };
    })
    .sort((left, right) => right.date.localeCompare(left.date));
};
