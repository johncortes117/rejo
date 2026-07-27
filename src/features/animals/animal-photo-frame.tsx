import type { CSSProperties } from "react";
import type { AnimalPhotoCrop } from "@/domain/models";
import { normalizeAnimalPhotoCrop } from "@/features/animals/animal-photo-crop";

const imageStyle = (crop?: AnimalPhotoCrop): CSSProperties => {
  const normalized = normalizeAnimalPhotoCrop(crop);
  return {
    objectPosition: `${normalized.x}% ${normalized.y}%`,
    transform: `scale(${normalized.zoom})`,
    transformOrigin: `${normalized.x}% ${normalized.y}%`
  };
};

export const AnimalPhotoFrame = ({
  name,
  photoUrl,
  crop,
  className = "",
  alt,
  onClick
}: {
  name: string;
  photoUrl: string;
  crop?: AnimalPhotoCrop;
  className?: string;
  alt?: string;
  onClick?: () => void;
}) => (
  <div className={`overflow-hidden bg-stone-200 ${className}`}>
    <img className={`h-full w-full object-cover ${onClick ? "cursor-zoom-in" : ""}`} style={imageStyle(crop)} src={photoUrl} alt={alt ?? `Foto de ${name}`} onClick={onClick} onError={(event) => { event.currentTarget.style.display = "none"; }} />
  </div>
);
