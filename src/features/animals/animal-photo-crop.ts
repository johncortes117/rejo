import type { AnimalPhotoCrop } from "@/domain/models";

export const defaultAnimalPhotoCrop: AnimalPhotoCrop = { x: 50, y: 50, zoom: 1 };

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));

export const normalizeAnimalPhotoCrop = (crop?: AnimalPhotoCrop): AnimalPhotoCrop => ({
  x: clamp(crop?.x ?? defaultAnimalPhotoCrop.x, 0, 100),
  y: clamp(crop?.y ?? defaultAnimalPhotoCrop.y, 0, 100),
  zoom: clamp(crop?.zoom ?? defaultAnimalPhotoCrop.zoom, 1, 2)
});
