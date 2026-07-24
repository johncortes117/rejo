import { afterEach, describe, expect, it } from "vitest";
import { RejoDb } from "@/db/rejo-db";
import { createDefaultPreventivePlan } from "@/features/health/default-plan";

const databases: RejoDb[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe("createDefaultPreventivePlan", () => {
  it("creates curada and annual brucellosis tasks exactly once", async () => {
    const database = new RejoDb(`rejo-default-plan-test-${crypto.randomUUID()}`);
    databases.push(database);
    const input = { farmId: "test-farm", userId: "test-user", startDate: "2026-07-24" };

    const tasks = await createDefaultPreventivePlan(database, input);
    const duplicate = await createDefaultPreventivePlan(database, input);

    expect(tasks.map((task) => task.taskType)).toEqual(["deworming", "annual_brucellosis_test"]);
    expect(await database.healthPlanTasks.count()).toBe(2);
    expect(await database.syncQueue.count()).toBe(2);
    expect(duplicate).toEqual([]);
  });
});
