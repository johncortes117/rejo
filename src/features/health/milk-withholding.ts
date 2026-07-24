import type { HealthEvent } from "@/domain/models";

const toDate = (date: string): Date => new Date(`${date}T00:00:00-05:00`);

export const computeMilkWithholdingUntil = (events: HealthEvent[]): string | undefined => {
  const deadlines = events
    .filter((event) => !event.deletedAt && event.milkWithdrawalHours && event.milkWithdrawalHours > 0)
    .map((event) => new Date(toDate(event.date).getTime() + event.milkWithdrawalHours! * 3_600_000));

  if (deadlines.length === 0) {
    return undefined;
  }

  return new Date(Math.max(...deadlines.map((deadline) => deadline.getTime()))).toISOString();
};

export const isMilkWithheld = (events: HealthEvent[], at: Date): boolean => {
  const until = computeMilkWithholdingUntil(events);
  return Boolean(until && new Date(until) > at);
};
