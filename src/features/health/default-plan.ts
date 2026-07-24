import { createUuidV7 } from "@/domain/ids";
import type { HealthPlanTask } from "@/domain/models";
import { queueUpsert } from "@/db/outbox";
import type { RejoDb } from "@/db/rejo-db";

const addDays = (date: string, days: number): string => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

export const createDefaultPreventivePlan = async (
  database: RejoDb,
  input: { farmId: string; userId: string; startDate: string },
  now = new Date()
): Promise<HealthPlanTask[]> => {
  const existing = await database.healthPlanTasks
    .filter((task) => task.farmId === input.farmId && task.isTemplate && !task.deletedAt)
    .count();
  if (existing > 0) {
    return [];
  }

  const timestamp = now.toISOString();
  const tasks: HealthPlanTask[] = [
    {
      id: createUuidV7(now.getTime()),
      farmId: input.farmId,
      category: "cow",
      taskType: "deworming",
      dueDate: addDays(input.startDate, 90),
      recurrenceDays: 90,
      isTemplate: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: input.userId
    },
    {
      id: createUuidV7(now.getTime() + 1),
      farmId: input.farmId,
      taskType: "annual_brucellosis_test",
      dueDate: addDays(input.startDate, 365),
      recurrenceDays: 365,
      isTemplate: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: input.userId
    }
  ];

  await database.transaction("rw", database.healthPlanTasks, database.syncQueue, async () => {
    await database.healthPlanTasks.bulkPut(tasks);
    await database.syncQueue.bulkPut(
      tasks.map((task) => queueUpsert(task.farmId, "health_plan_tasks", task.id, task as unknown as Record<string, unknown>, timestamp))
    );
  });

  return tasks;
};
