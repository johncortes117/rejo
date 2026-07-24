import type { HealthPlanTask } from "@/domain/models";
import { createUuidV7 } from "@/domain/ids";
import { queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";

const addDays = (date: string, days: number): string => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

export const updateHealthPlanTask = async (
  database: RejoDb,
  task: HealthPlanTask,
  action: "complete" | "postpone" | "ignore",
  now = new Date()
): Promise<HealthPlanTask> => {
  const timestamp = now.toISOString();
  const next: HealthPlanTask = action === "complete"
    ? { ...task, completedAt: timestamp, updatedAt: timestamp }
    : action === "ignore"
      ? { ...task, ignoredAt: timestamp, updatedAt: timestamp }
      : { ...task, dueDate: addDays(task.dueDate, 7), updatedAt: timestamp };

  const nextRecurringTask = action === "complete" && task.recurrenceDays
    ? {
        ...task,
        id: createUuidV7(now.getTime() + 1),
        dueDate: addDays(task.dueDate, task.recurrenceDays),
        completedAt: undefined,
        ignoredAt: undefined,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    : undefined;

  await database.transaction("rw", database.healthPlanTasks, database.syncQueue, async () => {
    await database.healthPlanTasks.put(next);
    await database.syncQueue.bulkPut([
      queueUpsert(next.farmId, "health_plan_tasks", next.id, next as unknown as Record<string, unknown>, timestamp),
      ...(nextRecurringTask ? [queueUpsert(nextRecurringTask.farmId, "health_plan_tasks", nextRecurringTask.id, nextRecurringTask as unknown as Record<string, unknown>, timestamp)] : [])
    ]);
    if (nextRecurringTask) {
      await database.healthPlanTasks.put(nextRecurringTask);
    }
  });

  return next;
};
