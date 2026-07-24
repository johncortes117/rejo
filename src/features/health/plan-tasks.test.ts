import { afterEach, describe, expect, it } from "vitest";
import { RejoDb } from "@/db/rejo-db";
import type { HealthPlanTask } from "@/domain/models";
import { updateHealthPlanTask } from "@/features/health/plan-tasks";

const databases: RejoDb[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

const createTask = (): HealthPlanTask => ({
  id: "task-1",
  farmId: "test-farm",
  animalId: "test-animal",
  taskType: "brucellosis_vaccination",
  dueDate: "2026-10-22",
  isTemplate: false,
  createdAt: "2026-07-24T12:00:00.000Z",
  updatedAt: "2026-07-24T12:00:00.000Z",
  createdBy: "test-user"
});

describe("updateHealthPlanTask", () => {
  it("postpones a task for seven days and queues the correction", async () => {
    const database = new RejoDb(`rejo-plan-task-test-${crypto.randomUUID()}`);
    databases.push(database);
    const task = createTask();
    await database.healthPlanTasks.put(task);

    const updated = await updateHealthPlanTask(database, task, "postpone", new Date("2026-10-20T12:00:00.000Z"));

    expect(updated.dueDate).toBe("2026-10-29");
    expect(await database.healthPlanTasks.get(task.id)).toMatchObject({ dueDate: "2026-10-29" });
    expect(await database.syncQueue.count()).toBe(1);
  });

  it("schedules the next recurring task after completion", async () => {
    const database = new RejoDb(`rejo-plan-task-test-${crypto.randomUUID()}`);
    databases.push(database);
    const task = { ...createTask(), recurrenceDays: 90 };
    await database.healthPlanTasks.put(task);

    await updateHealthPlanTask(database, task, "complete", new Date("2026-10-22T12:00:00.000Z"));

    const tasks = await database.healthPlanTasks.toArray();
    expect(tasks).toHaveLength(2);
    expect(tasks.find((item) => item.id !== task.id)).toMatchObject({ dueDate: "2027-01-20", completedAt: undefined });
  });
});
