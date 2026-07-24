import Dexie, { type EntityTable } from "dexie";
import type {
  Animal,
  Buyer,
  Farm,
  MilkUsage,
  SyncQueueItem,
  TankCalibration,
  TankReading
} from "@/domain/models";

export class RejoDb extends Dexie {
  farms!: EntityTable<Farm, "id">;
  buyers!: EntityTable<Buyer, "id">;
  tankCalibrations!: EntityTable<TankCalibration, "id">;
  animals!: EntityTable<Animal, "id">;
  tankReadings!: EntityTable<TankReading, "id">;
  milkUsages!: EntityTable<MilkUsage, "id">;
  syncQueue!: EntityTable<SyncQueueItem, "id">;

  constructor(name = "rejo") {
    super(name);

    this.version(1).stores({
      farms: "id, farmId, updatedAt, deletedAt",
      buyers: "id, farmId, updatedAt, deletedAt",
      tankCalibrations: "id, farmId, [farmId+mark], updatedAt, deletedAt",
      animals: "id, farmId, [farmId+name], updatedAt, deletedAt",
      tankReadings: "id, farmId, [farmId+date], [farmId+date+moment], updatedAt, deletedAt",
      milkUsages: "id, farmId, [farmId+date], updatedAt, deletedAt",
      syncQueue: "id, farmId, [farmId+completedAt], createdAt"
    });
  }
}

export const db = new RejoDb();
