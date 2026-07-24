import type { Animal, Calving, HealthEvent, HealthPlanTask, Heat, PregnancyCheck, Service, TankReading } from "@/domain/models";
import type { RejoDb } from "@/db/rejo-db";
import { computeMilkWithholdingUntil, isMilkWithheld } from "@/features/health/milk-withholding";
import { computeReproductiveState } from "@/features/reproduction/reproductive-state";

export type DecisionAlertTone = "critical" | "attention" | "watch";

export interface DecisionAlert {
  id: string;
  tone: DecisionAlertTone;
  title: string;
  detail: string;
}

export interface MilkTrendPoint {
  date: string;
  liters: number;
}

export interface DecisionDashboard {
  alerts: DecisionAlert[];
  trend: MilkTrendPoint[];
  sevenDayAverage?: number;
  trendDirection?: "up" | "down" | "steady";
}

interface DecisionDashboardFacts {
  businessDate: string;
  now: Date;
  animals: Animal[];
  healthEvents: HealthEvent[];
  healthPlanTasks: HealthPlanTask[];
  heats: Heat[];
  services: Service[];
  pregnancyChecks: PregnancyCheck[];
  calvings: Calving[];
  tankReadings: TankReading[];
}

const addDays = (date: string, days: number): string => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const daysBetween = (from: string, to: string): number => {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000);
};

const latestFarmPickup = (readings: TankReading[]): TankReading | undefined =>
  readings
    .filter((reading) => !reading.deletedAt && reading.moment === "at_pickup" && reading.readBy === "farm")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

const buildTrend = (businessDate: string, readings: TankReading[]): MilkTrendPoint[] => {
  const firstDate = addDays(businessDate, -29);
  const byDate = new Map<string, TankReading[]>();
  readings
    .filter((reading) => reading.date >= firstDate && reading.date <= businessDate)
    .forEach((reading) => byDate.set(reading.date, [...(byDate.get(reading.date) ?? []), reading]));

  return [...byDate.entries()]
    .map(([date, dateReadings]) => ({ date, liters: latestFarmPickup(dateReadings)?.liters }))
    .filter((point): point is MilkTrendPoint => point.liters !== undefined)
    .sort((left, right) => left.date.localeCompare(right.date));
};

const trendDirection = (trend: MilkTrendPoint[]): DecisionDashboard["trendDirection"] => {
  if (trend.length < 4) return undefined;
  const latest = trend.slice(-3).reduce((total, point) => total + point.liters, 0) / 3;
  const previous = trend.slice(-6, -3).reduce((total, point) => total + point.liters, 0) / 3;
  if (previous === 0 || Math.abs(latest - previous) / previous < 0.03) return "steady";
  return latest > previous ? "up" : "down";
};

export const buildDecisionDashboard = (facts: DecisionDashboardFacts): DecisionDashboard => {
  const alerts: DecisionAlert[] = [];
  const activeAnimals = facts.animals.filter((animal) => !animal.deletedAt && animal.status === "active");

  activeAnimals.forEach((animal) => {
    const animalEvents = facts.healthEvents.filter((event) => event.animalId === animal.id && !event.deletedAt);
    if (isMilkWithheld(animalEvents, facts.now)) {
      const until = computeMilkWithholdingUntil(animalEvents);
      alerts.push({
        id: `withholding-${animal.id}`,
        tone: "critical",
        title: `${animal.name}: no se puede entregar su leche`,
        detail: `Retiro vigente hasta ${new Date(until!).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}.`
      });
    }

    const state = computeReproductiveState({
      asOf: facts.businessDate,
      sex: animal.sex,
      heats: facts.heats.filter((event) => event.animalId === animal.id),
      services: facts.services.filter((event) => event.animalId === animal.id),
      pregnancyChecks: facts.pregnancyChecks.filter((event) => event.animalId === animal.id),
      calvings: facts.calvings.filter((event) => event.animalId === animal.id)
    });
    if (state.isRepeatBreeder) {
      alerts.push({ id: `repeat-${animal.id}`, tone: "attention", title: `${animal.name}: vaca repetidora`, detail: "Tiene tres o más servicios sin preñez confirmada; conviene revisar brucelosis." });
    }
    if (state.expectedCalvingDate) {
      const daysToCalving = daysBetween(facts.businessDate, state.expectedCalvingDate);
      if (daysToCalving >= 0 && daysToCalving <= 7) {
        alerts.push({ id: `calving-${animal.id}`, tone: "critical", title: `${animal.name}: parto cercano`, detail: `Parto estimado en ${daysToCalving} ${daysToCalving === 1 ? "día" : "días"}.` });
      }
    }
  });

  facts.healthPlanTasks
    .filter((task) => !task.deletedAt && !task.completedAt && !task.ignoredAt && task.dueDate <= facts.businessDate)
    .forEach((task) => {
      const animal = activeAnimals.find((item) => item.id === task.animalId);
      const name = task.taskType === "deworming" ? "Curada" : task.taskType === "brucellosis_vaccination" ? "Vacuna de brucelosis" : "Prueba anual de brucelosis";
      alerts.push({
        id: `task-${task.id}`,
        tone: task.dueDate < facts.businessDate ? "attention" : "watch",
        title: `${name}${animal ? `: ${animal.name}` : ""}`,
        detail: task.dueDate < facts.businessDate ? `Pendiente desde ${task.dueDate}.` : "Programada para hoy."
      });
    });

  const trend = buildTrend(facts.businessDate, facts.tankReadings);
  const lastSeven = trend.slice(-7);
  return {
    alerts: alerts.sort((left, right) => (left.tone === "critical" ? -1 : left.tone === "attention" && right.tone === "watch" ? -1 : 0)),
    trend,
    sevenDayAverage: lastSeven.length ? Math.round((lastSeven.reduce((total, point) => total + point.liters, 0) / lastSeven.length) * 10) / 10 : undefined,
    trendDirection: trendDirection(trend)
  };
};

export const getDecisionDashboard = async (database: RejoDb, farmId: string, businessDate: string, now = new Date()): Promise<DecisionDashboard> => {
  const [animals, healthEvents, healthPlanTasks, heats, services, pregnancyChecks, calvings, tankReadings] = await Promise.all([
    database.animals.filter((item) => item.farmId === farmId).toArray(),
    database.healthEvents.filter((item) => item.farmId === farmId).toArray(),
    database.healthPlanTasks.filter((item) => item.farmId === farmId).toArray(),
    database.heats.filter((item) => item.farmId === farmId).toArray(),
    database.services.filter((item) => item.farmId === farmId).toArray(),
    database.pregnancyChecks.filter((item) => item.farmId === farmId).toArray(),
    database.calvings.filter((item) => item.farmId === farmId).toArray(),
    database.tankReadings.filter((item) => item.farmId === farmId).toArray()
  ]);
  return buildDecisionDashboard({ businessDate, now, animals, healthEvents, healthPlanTasks, heats, services, pregnancyChecks, calvings, tankReadings });
};
