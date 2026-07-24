import type { Calving, Heat, PregnancyCheck, Service } from "@/domain/models";

export type ReproductiveStatus =
  | "open"
  | "in_heat"
  | "served"
  | "pregnant_presumed"
  | "pregnant_confirmed"
  | "fresh"
  | "not_applicable";

export interface ReproductiveState {
  status: ReproductiveStatus;
  isRepeatBreeder: boolean;
  serviceCount: number;
  expectedCalvingDate?: string;
}

interface ReproductiveFacts {
  asOf: string;
  sex?: "female" | "male";
  heats: Heat[];
  services: Service[];
  pregnancyChecks: PregnancyCheck[];
  calvings: Calving[];
}

const activeBefore = <T extends { date: string; deletedAt?: string }>(items: T[], asOf: string): T[] =>
  items.filter((item) => !item.deletedAt && item.date <= asOf);

const latestByDate = <T extends { date: string }>(items: T[]): T | undefined =>
  [...items].sort((left, right) => right.date.localeCompare(left.date))[0];

const dayDifference = (from: string, to: string): number => {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000);
};

const addDays = (date: string, days: number): string => {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
};

export const computeReproductiveState = ({
  asOf,
  sex,
  heats,
  services,
  pregnancyChecks,
  calvings
}: ReproductiveFacts): ReproductiveState => {
  if (sex === "male") {
    return { status: "not_applicable", isRepeatBreeder: false, serviceCount: 0 };
  }

  const currentCalving = latestByDate(activeBefore(calvings, asOf));
  if (currentCalving) {
    const daysSinceCalving = dayDifference(currentCalving.date, asOf);
    if (daysSinceCalving >= 0 && daysSinceCalving <= 60) {
      return { status: "fresh", isRepeatBreeder: false, serviceCount: 0 };
    }
  }

  const cutoff = currentCalving?.date;
  const currentServices = activeBefore(services, asOf).filter((service) => !cutoff || service.date > cutoff);
  const latestService = latestByDate(currentServices);
  const currentChecks = activeBefore(pregnancyChecks, asOf).filter((check) => !cutoff || check.date > cutoff);
  const latestCheck = latestByDate(currentChecks);
  const serviceCount = currentServices.length;
  const isRepeatBreeder = serviceCount >= 3 && latestCheck?.result !== "pregnant";

  if (latestCheck?.result === "pregnant") {
    return {
      status: "pregnant_confirmed",
      isRepeatBreeder: false,
      serviceCount,
      expectedCalvingDate: latestService ? addDays(latestService.date, 280) : undefined
    };
  }

  if (latestCheck?.result === "open") {
    return { status: "open", isRepeatBreeder, serviceCount };
  }

  if (latestService) {
    const daysAfterService = dayDifference(latestService.date, asOf);
    const returnHeat = activeBefore(heats, asOf).some((heat) => {
      const daysAfterServiceHeat = dayDifference(latestService.date, heat.date);
      return daysAfterServiceHeat >= 18 && daysAfterServiceHeat <= 26;
    });

    if (returnHeat) {
      return { status: "open", isRepeatBreeder, serviceCount };
    }

    if (daysAfterService > 26) {
      return {
        status: "pregnant_presumed",
        isRepeatBreeder: false,
        serviceCount,
        expectedCalvingDate: addDays(latestService.date, 280)
      };
    }

    return { status: "served", isRepeatBreeder, serviceCount };
  }

  const latestHeat = latestByDate(activeBefore(heats, asOf));
  return { status: latestHeat ? "in_heat" : "open", isRepeatBreeder: false, serviceCount: 0 };
};
