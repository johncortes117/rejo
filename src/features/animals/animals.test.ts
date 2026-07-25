import { afterEach, describe, expect, it } from "vitest";
import { RejoDb } from "@/db/rejo-db";
import { saveAnimal } from "@/features/animals/animals";

const databases: RejoDb[] = [];

const createTestDatabase = () => {
  const database = new RejoDb(`rejo-animal-test-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
};

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe("saveAnimal", () => {
  it("keeps optional photo and historical calving count local and queues them for backup", async () => {
    const database = createTestDatabase();
    const photoUrl = "data:image/jpeg;base64,cGhvdG8=";

    const animal = await saveAnimal(database, {
      farmId: "test-farm",
      userId: "test-user",
      name: "Lucero",
      photoUrl,
      previousCalvingCount: 3
    }, new Date("2026-07-25T12:00:00.000Z"));

    expect(await database.animals.get(animal.id)).toMatchObject({
      name: "Lucero",
      photoUrl,
      previousCalvingCount: 3
    });
    const operation = (await database.syncQueue.toArray()).find((item) => item.entityId === animal.id);
    expect(operation?.payload).toMatchObject({ photoUrl, previousCalvingCount: 3 });
  });

  it("clears a previously saved photo in the local record and backup payload", async () => {
    const database = createTestDatabase();
    const animal = await saveAnimal(database, {
      farmId: "test-farm",
      userId: "test-user",
      name: "Canela",
      photoUrl: "data:image/jpeg;base64,cGhvdG8="
    });

    await saveAnimal(database, {
      farmId: "test-farm",
      userId: "test-user",
      id: animal.id,
      name: "Canela",
      photoUrl: null
    });

    expect((await database.animals.get(animal.id))?.photoUrl).toBeUndefined();
    const operations = await database.syncQueue.toArray();
    expect(operations.at(-1)?.payload.photoUrl).toBeNull();
  });

  it("normalizes and clears a historical calving count", async () => {
    const database = createTestDatabase();
    const animal = await saveAnimal(database, {
      farmId: "test-farm",
      userId: "test-user",
      name: "Canela",
      previousCalvingCount: 2.8
    });

    expect((await database.animals.get(animal.id))?.previousCalvingCount).toBe(2);

    await saveAnimal(database, {
      farmId: "test-farm",
      userId: "test-user",
      id: animal.id,
      name: "Canela",
      previousCalvingCount: null
    });

    expect((await database.animals.get(animal.id))?.previousCalvingCount).toBeUndefined();
    expect((await database.syncQueue.toArray()).at(-1)?.payload.previousCalvingCount).toBeNull();
  });
});
