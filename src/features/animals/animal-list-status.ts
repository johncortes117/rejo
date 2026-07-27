import type { Animal, Calving, Heat, HealthEvent, MilkControlRecord, MilkControlSession, PregnancyCheck, Service } from "@/domain/models";
import { isMilkWithheld } from "@/features/health/milk-withholding";
import { computeReproductiveState } from "@/features/reproduction/reproductive-state";

export type AnimalListStatusTone = "critical" | "attention" | "positive" | "neutral";

export interface AnimalListStatus {
  label: string;
  tone: AnimalListStatusTone;
}

const dayDifference = (from: string, to: string): number => {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000);
};

const latestMilkReading = (animalId: string, sessions: MilkControlSession[], records: MilkControlRecord[]): { date: string; liters: number } | undefined => {
  const datesBySession = new Map(sessions.filter((session) => !session.deletedAt).map((session) => [session.id, session.date]));
  return records
    .filter((record) => !record.deletedAt && record.animalId === animalId && datesBySession.has(record.sessionId))
    .map((record) => ({ date: datesBySession.get(record.sessionId)!, liters: record.liters }))
    .sort((left, right) => right.date.localeCompare(left.date))[0];
};

export const buildAnimalListStatuses = ({
  animal,
  asOf,
  now,
  healthEvents,
  heats,
  services,
  pregnancyChecks,
  calvings,
  milkControlSessions,
  milkControlRecords
}: {
  animal: Animal;
  asOf: string;
  now: Date;
  healthEvents: HealthEvent[];
  heats: Heat[];
  services: Service[];
  pregnancyChecks: PregnancyCheck[];
  calvings: Calving[];
  milkControlSessions: MilkControlSession[];
  milkControlRecords: MilkControlRecord[];
}): AnimalListStatus[] => {
  const animalHealthEvents = healthEvents.filter((event) => event.animalId === animal.id);
  const state = computeReproductiveState({
    asOf,
    sex: animal.sex,
    heats: heats.filter((event) => event.animalId === animal.id),
    services: services.filter((event) => event.animalId === animal.id),
    pregnancyChecks: pregnancyChecks.filter((event) => event.animalId === animal.id),
    calvings: calvings.filter((event) => event.animalId === animal.id)
  });
  const statuses: AnimalListStatus[] = [];

  if (isMilkWithheld(animalHealthEvents, now)) {
    statuses.push({ label: "No entregar leche", tone: "critical" });
  }

  if (state.isRepeatBreeder) {
    statuses.push({ label: `Repetidora · ${state.serviceCount} servicios`, tone: "critical" });
  } else if (state.status === "in_heat") {
    statuses.push({ label: "En celo", tone: "attention" });
  } else if (state.expectedCalvingDate) {
    const daysUntilCalving = dayDifference(asOf, state.expectedCalvingDate);
    if (daysUntilCalving >= 0 && daysUntilCalving <= 45) {
      statuses.push({ label: daysUntilCalving === 0 ? "Parto estimado hoy" : `Parto en ${daysUntilCalving} días`, tone: "attention" });
    }
  }

  if (state.status === "pregnant_confirmed" && !statuses.some((status) => status.label.startsWith("Parto"))) {
    statuses.push({ label: "Preñada", tone: "positive" });
  } else if (state.status === "pregnant_presumed" && !statuses.some((status) => status.label.startsWith("Parto"))) {
    statuses.push({ label: "Parece preñada", tone: "positive" });
  } else if (state.status === "served") {
    statuses.push({ label: "Servida", tone: "attention" });
  } else if (state.status === "fresh") {
    statuses.push({ label: "Recién parida", tone: "attention" });
  }

  const latestMilk = latestMilkReading(animal.id, milkControlSessions, milkControlRecords);
  if (latestMilk) {
    statuses.push({ label: `${latestMilk.liters.toFixed(1)} L · último control`, tone: "neutral" });
  }

  if (statuses.length === 0 && animal.previousCalvingCount) {
    statuses.push({ label: `${animal.previousCalvingCount} ${animal.previousCalvingCount === 1 ? "parto" : "partos"}`, tone: "neutral" });
  } else if (statuses.length === 0 && animal.sex === "male") {
    statuses.push({ label: "Macho", tone: "neutral" });
  }

  return statuses.slice(0, 2);
};
