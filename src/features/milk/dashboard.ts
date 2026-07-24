import { subDays } from "date-fns";
import { toBusinessDate } from "@/domain/time";
import type { TankReading } from "@/domain/models";
import type { RejoDb } from "@/db/rejo-db";

const pickupReadingForDay = (readings: TankReading[]): TankReading | undefined =>
  readings
    .filter((reading) => !reading.deletedAt && reading.moment === "at_pickup" && reading.readBy === "farm")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

export interface MilkDashboard {
  todayLiters?: number;
  sevenDayAverage?: number;
}

export const getMilkDashboard = async (
  database: RejoDb,
  farmId: string,
  businessDate: string
): Promise<MilkDashboard> => {
  const [year, month, day] = businessDate.split("-").map(Number);
  const dayStart = new Date(Date.UTC(year, month - 1, day, 12));
  const firstDay = toBusinessDate(subDays(dayStart, 6));

  const readings = await database.tankReadings
    .filter(
      (reading) =>
        reading.farmId === farmId &&
        !reading.deletedAt &&
        reading.date >= firstDay &&
        reading.date <= businessDate
    )
    .toArray();

  const readingsByDate = new Map<string, TankReading[]>();
  for (const reading of readings) {
    const dayReadings = readingsByDate.get(reading.date) ?? [];
    dayReadings.push(reading);
    readingsByDate.set(reading.date, dayReadings);
  }

  const dailyReadings = [...readingsByDate.values()]
    .map(pickupReadingForDay)
    .filter((reading): reading is TankReading => Boolean(reading));
  const todayReading = pickupReadingForDay(readingsByDate.get(businessDate) ?? []);

  return {
    todayLiters: todayReading?.liters,
    sevenDayAverage:
      dailyReadings.length === 0
        ? undefined
        : Math.round(
            (dailyReadings.reduce((total, reading) => total + reading.liters, 0) /
              dailyReadings.length) *
              10
          ) / 10
  };
};
