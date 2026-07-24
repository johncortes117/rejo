export type EntityId = string;

export interface RecordMeta {
  id: EntityId;
  farmId: EntityId;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  syncedAt?: string;
  createdBy: EntityId;
}

export interface Farm extends RecordMeta {
  name: string;
  ownerName?: string;
  province?: string;
  canton?: string;
  sector?: string;
  hectares?: number;
  altitudeM?: number;
  timezone: string;
  brucellosisFree: boolean;
  bppCertified: boolean;
}

export interface Buyer extends RecordMeta {
  name: string;
  type: "industry" | "collection_center" | "cheese_maker" | "middleman" | "direct";
  contact?: string;
  paymentFrequency?: "daily" | "weekly" | "biweekly" | "monthly";
  agreedPricePerLiter?: number;
  paysQualityBonus: boolean;
}

export interface TankCalibration extends RecordMeta {
  mark: number;
  liters: number;
  unitLabel: string;
}

export type AnimalSex = "female" | "male";

export interface Animal extends RecordMeta {
  name: string;
  sex?: AnimalSex;
  birthDate?: string;
  birthDateEstimated: boolean;
  photoUrl?: string;
  status: "active" | "sold" | "dead" | "culled";
}

export type TankReadingMoment =
  | "after_afternoon_milking"
  | "after_dawn_milking"
  | "at_pickup";

export interface TankReading extends RecordMeta {
  date: string;
  time: string;
  moment: TankReadingMoment;
  mark?: number;
  liters: number;
  readBy: "farm" | "buyer";
  notes?: string;
}

export type MilkUsageType =
  | "calves"
  | "household"
  | "cheese"
  | "discarded_colostrum"
  | "discarded_mastitis"
  | "discarded_withdrawal"
  | "spilled";

export interface MilkUsage extends RecordMeta {
  date: string;
  type: MilkUsageType;
  liters: number;
  animalId?: EntityId;
  notes?: string;
}

export interface Heat extends RecordMeta {
  animalId: EntityId;
  date: string;
  detectedBy?: string;
  detectedWhere?: "milking" | "paddock" | "corral";
  signs?: string;
  served: boolean;
}

export interface Service extends RecordMeta {
  animalId: EntityId;
  date: string;
  type: "natural" | "ai";
  bullId?: EntityId;
  strawCode?: string;
  strawBullName?: string;
  technician?: string;
  cost?: number;
  serviceNumber: number;
}

export interface PregnancyCheck extends RecordMeta {
  animalId: EntityId;
  date: string;
  method: "palpation" | "ultrasound" | "blood";
  result: "pregnant" | "open" | "doubtful";
  estimatedDays?: number;
  technician?: string;
  cost?: number;
}

export interface Calving extends RecordMeta {
  animalId: EntityId;
  date: string;
  type: "normal" | "assisted" | "cesarean";
  outcome: "live" | "stillborn" | "abortion" | "twins";
  calfIds: EntityId[];
  complications?: string;
  notes?: string;
}

export interface DryOff extends RecordMeta {
  animalId: EntityId;
  date: string;
  plannedDate?: string;
  treatmentApplied?: string;
  expectedCalvingDate?: string;
}

export interface HealthEvent extends RecordMeta {
  animalId?: EntityId;
  date: string;
  type: "vaccination" | "deworming" | "vitamin" | "mastitis" | "lameness" | "metabolic" | "injury" | "reproductive" | "brucellosis_test" | "other";
  productName?: string;
  activeIngredient?: string;
  milkWithdrawalHours?: number;
  notes?: string;
}

export type SyncOperation = "upsert" | "soft_delete";

export interface SyncQueueItem {
  id: EntityId;
  farmId: EntityId;
  entityTable:
    | "farms"
    | "buyers"
    | "tank_calibrations"
    | "animals"
    | "tank_readings"
    | "milk_usages"
    | "heats"
    | "services"
    | "pregnancy_checks"
    | "calvings"
    | "dry_offs"
    | "health_events";
  entityId: EntityId;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  idempotencyKey: EntityId;
  attemptCount: number;
  createdAt: string;
  lastAttemptAt?: string;
  lastError?: string;
  completedAt?: string;
}

export interface FarmSession {
  farmId: EntityId;
  userId: EntityId;
  role: "admin" | "owner";
}
