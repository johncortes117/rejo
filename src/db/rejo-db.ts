import Dexie, { type EntityTable } from "dexie";
import type {
  Animal,
  Buyer,
  Calving,
  DryOff,
  Farm,
  Heat,
  HealthEvent,
  MilkUsage,
  PregnancyCheck,
  Service,
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
  heats!: EntityTable<Heat, "id">;
  services!: EntityTable<Service, "id">;
  pregnancyChecks!: EntityTable<PregnancyCheck, "id">;
  calvings!: EntityTable<Calving, "id">;
  dryOffs!: EntityTable<DryOff, "id">;
  healthEvents!: EntityTable<HealthEvent, "id">;
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

    this.version(2).stores({
      farms: "id, farmId, updatedAt, deletedAt",
      buyers: "id, farmId, updatedAt, deletedAt",
      tankCalibrations: "id, farmId, [farmId+mark], updatedAt, deletedAt",
      animals: "id, farmId, [farmId+name], updatedAt, deletedAt",
      tankReadings: "id, farmId, [farmId+date], [farmId+date+moment], updatedAt, deletedAt",
      milkUsages: "id, farmId, [farmId+date], updatedAt, deletedAt",
      heats: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt",
      services: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt",
      pregnancyChecks: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt",
      calvings: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt",
      dryOffs: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt",
      syncQueue: "id, farmId, [farmId+completedAt], createdAt"
    });

    this.version(3).stores({
      farms: "id, farmId, updatedAt, deletedAt",
      buyers: "id, farmId, updatedAt, deletedAt",
      tankCalibrations: "id, farmId, [farmId+mark], updatedAt, deletedAt",
      animals: "id, farmId, [farmId+name], updatedAt, deletedAt",
      tankReadings: "id, farmId, [farmId+date], [farmId+date+moment], updatedAt, deletedAt",
      milkUsages: "id, farmId, [farmId+date], updatedAt, deletedAt",
      heats: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt",
      services: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt",
      pregnancyChecks: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt",
      calvings: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt",
      dryOffs: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt",
      healthEvents: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt",
      syncQueue: "id, farmId, [farmId+completedAt], createdAt"
    });
  }
}

export const db = new RejoDb();
