import Dexie, { type EntityTable } from "dexie";
import type {
  Animal,
  Asset,
  Buyer,
  Calving,
  DryOff,
  Farm,
  Heat,
  HealthEvent,
  HealthPlanTask,
  HerdGroup,
  LaborRecord,
  MilkQualityTest,
  MilkUsage,
  PriceSetting,
  PregnancyCheck,
  Service,
  SyncQueueItem,
  Settlement,
  TankCalibration,
  TankReading,
  Transaction
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
  healthPlanTasks!: EntityTable<HealthPlanTask, "id">;
  herdGroups!: EntityTable<HerdGroup, "id">;
  milkQualityTests!: EntityTable<MilkQualityTest, "id">;
  priceSettings!: EntityTable<PriceSetting, "id">;
  settlements!: EntityTable<Settlement, "id">;
  transactions!: EntityTable<Transaction, "id">;
  assets!: EntityTable<Asset, "id">;
  labor!: EntityTable<LaborRecord, "id">;
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

    this.version(4).stores({
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
      healthPlanTasks: "id, farmId, [farmId+animalId], [farmId+dueDate], updatedAt, deletedAt",
      syncQueue: "id, farmId, [farmId+completedAt], createdAt"
    });

    this.version(5).stores({
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
      healthPlanTasks: "id, farmId, [farmId+animalId], [farmId+dueDate], updatedAt, deletedAt",
      milkQualityTests: "id, farmId, [farmId+date], updatedAt, deletedAt",
      priceSettings: "id, farmId, [farmId+effectiveFrom], updatedAt, deletedAt",
      settlements: "id, farmId, [farmId+periodEnd], [farmId+buyerId], updatedAt, deletedAt",
      syncQueue: "id, farmId, [farmId+completedAt], createdAt"
    });

    this.version(6).stores({
      farms: "id, farmId, updatedAt, deletedAt", buyers: "id, farmId, updatedAt, deletedAt", tankCalibrations: "id, farmId, [farmId+mark], updatedAt, deletedAt", animals: "id, farmId, [farmId+name], updatedAt, deletedAt", tankReadings: "id, farmId, [farmId+date], [farmId+date+moment], updatedAt, deletedAt", milkUsages: "id, farmId, [farmId+date], updatedAt, deletedAt", heats: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt", services: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt", pregnancyChecks: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt", calvings: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt", dryOffs: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt", healthEvents: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt", healthPlanTasks: "id, farmId, [farmId+animalId], [farmId+dueDate], updatedAt, deletedAt", milkQualityTests: "id, farmId, [farmId+date], updatedAt, deletedAt", priceSettings: "id, farmId, [farmId+effectiveFrom], updatedAt, deletedAt", settlements: "id, farmId, [farmId+periodEnd], [farmId+buyerId], updatedAt, deletedAt", transactions: "id, farmId, [farmId+date], [farmId+direction], updatedAt, deletedAt", assets: "id, farmId, updatedAt, deletedAt", labor: "id, farmId, [farmId+period], updatedAt, deletedAt", syncQueue: "id, farmId, [farmId+completedAt], createdAt"
    });

    this.version(7).stores({
      farms: "id, farmId, updatedAt, deletedAt", buyers: "id, farmId, updatedAt, deletedAt", tankCalibrations: "id, farmId, [farmId+mark], updatedAt, deletedAt", animals: "id, farmId, [farmId+name], [farmId+herdGroupId], updatedAt, deletedAt", herdGroups: "id, farmId, [farmId+sortOrder], updatedAt, deletedAt", tankReadings: "id, farmId, [farmId+date], [farmId+date+moment], updatedAt, deletedAt", milkUsages: "id, farmId, [farmId+date], updatedAt, deletedAt", heats: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt", services: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt", pregnancyChecks: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt", calvings: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt", dryOffs: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt", healthEvents: "id, farmId, [farmId+animalId], [farmId+date], updatedAt, deletedAt", healthPlanTasks: "id, farmId, [farmId+animalId], [farmId+dueDate], updatedAt, deletedAt", milkQualityTests: "id, farmId, [farmId+date], updatedAt, deletedAt", priceSettings: "id, farmId, [farmId+effectiveFrom], updatedAt, deletedAt", settlements: "id, farmId, [farmId+periodEnd], [farmId+buyerId], updatedAt, deletedAt", transactions: "id, farmId, [farmId+date], [farmId+direction], updatedAt, deletedAt", assets: "id, farmId, updatedAt, deletedAt", labor: "id, farmId, [farmId+period], updatedAt, deletedAt", syncQueue: "id, farmId, [farmId+completedAt], createdAt"
    });
  }
}

export const db = new RejoDb();
