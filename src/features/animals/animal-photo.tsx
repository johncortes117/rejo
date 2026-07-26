import { type ChangeEvent, type PointerEvent, useId, useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { AnimalPhotoCrop } from "@/domain/models";
import { defaultAnimalPhotoCrop, normalizeAnimalPhotoCrop } from "@/features/animals/animal-photo-crop";
import { AnimalPhotoFrame } from "@/features/animals/animal-photo-frame";
import { prepareAnimalPhoto } from "@/features/animals/animal-photo-utils";

export const AnimalAvatar = ({
  name,
  photoUrl,
  crop,
  size = "row"
}: {
  name: string;
  photoUrl?: string;
  crop?: AnimalPhotoCrop;
  size?: "row" | "detail" | "preview";
}) => {
  const sizeClasses = {
    row: "h-10 w-10 rounded-xl text-base",
    detail: "h-16 w-16 rounded-2xl text-2xl",
    preview: "h-24 w-24 rounded-2xl text-3xl"
  }[size];

  return <span className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-lime-100 font-black text-lime-950 ${sizeClasses}`}>
    <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
    {photoUrl ? <AnimalPhotoFrame name={name} photoUrl={photoUrl} crop={crop} className="absolute inset-0" /> : null}
  </span>;
};

const CropGuide = () => <span aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.18)] before:absolute before:inset-y-0 before:left-1/3 before:border-l before:border-dashed before:border-white/70 after:absolute after:inset-x-0 after:top-1/2 after:border-t after:border-dashed after:border-white/70" />;

const AnimalPhotoCropEditor = ({ value, crop, disabled, onChange }: { value: string; crop?: AnimalPhotoCrop; disabled: boolean; onChange: (crop: AnimalPhotoCrop) => void }) => {
  const drag = useRef<{ startX: number; startY: number; crop: AnimalPhotoCrop }>();
  const current = normalizeAnimalPhotoCrop(crop);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || disabled) return;
    const distanceX = event.clientX - drag.current.startX;
    const distanceY = event.clientY - drag.current.startY;
    onChange({ ...drag.current.crop, x: Math.min(100, Math.max(0, drag.current.crop.x - distanceX / 2.2)), y: Math.min(100, Math.max(0, drag.current.crop.y - distanceY / 2.2)) });
  };

  return <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-3" aria-label="Editar encuadre de la foto">
    <div className="relative aspect-[4/3] touch-none overflow-hidden rounded-xl bg-stone-950" onPointerDown={(event) => { if (disabled) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { startX: event.clientX, startY: event.clientY, crop: current }; }} onPointerMove={move} onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}>
      <AnimalPhotoFrame name="animal" photoUrl={value} crop={current} alt="Vista previa del encuadre" className="absolute inset-0" />
      <CropGuide />
    </div>
    <p className="mt-3 text-sm font-semibold text-stone-700">Arrastra la foto para acomodarla dentro del marco.</p>
    <div className="mt-3 space-y-3">
      <label className="block text-sm font-bold text-stone-800">Acercar o alejar<input className="mt-1.5 block w-full accent-lime-700" type="range" min="1" max="2" step="0.05" value={current.zoom} disabled={disabled} aria-label="Acercar o alejar la foto" onChange={(event) => onChange({ ...current, zoom: Number(event.target.value) })} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-bold text-stone-800">Horizontal<input className="mt-1.5 block w-full accent-lime-700" type="range" min="0" max="100" value={current.x} disabled={disabled} aria-label="Mover foto horizontalmente" onChange={(event) => onChange({ ...current, x: Number(event.target.value) })} /></label>
        <label className="block text-sm font-bold text-stone-800">Vertical<input className="mt-1.5 block w-full accent-lime-700" type="range" min="0" max="100" value={current.y} disabled={disabled} aria-label="Mover foto verticalmente" onChange={(event) => onChange({ ...current, y: Number(event.target.value) })} /></label>
      </div>
    </div>
    <Button type="button" disabled={disabled} className="mt-3 min-h-10 w-full bg-stone-100 px-3 py-2 text-sm text-stone-800" onClick={() => onChange(defaultAnimalPhotoCrop)}><RotateCcw size={17} aria-hidden="true" />Centrar foto</Button>
  </section>;
};

export const AnimalPhotoPicker = ({
  value,
  crop,
  animalName,
  disabled = false,
  onChange,
  onCropChange,
  onPreparingChange
}: {
  value?: string;
  crop?: AnimalPhotoCrop;
  animalName: string;
  disabled?: boolean;
  onChange: (value?: string, crop?: AnimalPhotoCrop) => void;
  onCropChange?: (crop: AnimalPhotoCrop) => void;
  onPreparingChange?: (isPreparing: boolean) => void;
}) => {
  const cameraInputId = useId();
  const galleryInputId = useId();
  const [isPreparing, setIsPreparing] = useState(false);
  const [isEditingCrop, setIsEditingCrop] = useState(false);
  const [error, setError] = useState<string>();

  const changePreparing = (next: boolean) => {
    setIsPreparing(next);
    onPreparingChange?.(next);
  };

  const selectPhoto = async (file?: File) => {
    if (!file || disabled || isPreparing) return;
    setError(undefined);
    changePreparing(true);
    try {
      onChange(await prepareAnimalPhoto(file), defaultAnimalPhotoCrop);
      setIsEditingCrop(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo preparar la foto.");
    } finally {
      changePreparing(false);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    void selectPhoto(file);
  };

  const controlsDisabled = disabled || isPreparing;

  return <section aria-label="Foto del animal" className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
    <div className="flex items-center gap-3">
      <AnimalAvatar name={animalName || "?"} photoUrl={value} crop={crop} size="preview" />
      <div className="min-w-0 flex-1">
        <p className="font-black text-stone-950">Foto del animal <span className="font-medium text-stone-500">(opcional)</span></p>
        <p className="mt-1 text-sm leading-snug text-stone-600">Ayuda a reconocerlo rápido en la lista.</p>
        {isPreparing ? <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-lime-800" role="status"><LoaderCircle className="animate-spin" size={16} aria-hidden="true" />Preparando foto…</p> : null}
      </div>
    </div>

    {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-900" role="alert">{error}</p> : null}

    <div className="mt-4 grid grid-cols-2 gap-2">
      <label htmlFor={cameraInputId} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime-700 px-3 py-2 text-sm font-bold text-white transition ${controlsDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-[0.98]"}`}>
        <Camera size={18} aria-hidden="true" />Tomar foto
        <input id={cameraInputId} className="sr-only" type="file" accept="image/*" capture="environment" aria-label="Tomar foto del animal" disabled={controlsDisabled} onChange={handleFile} />
      </label>
      <label htmlFor={galleryInputId} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-stone-800 ring-1 ring-stone-200 transition ${controlsDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-[0.98]"}`}>
        <ImagePlus size={18} aria-hidden="true" />Elegir foto
        <input id={galleryInputId} className="sr-only" type="file" accept="image/*" aria-label="Elegir foto del animal" disabled={controlsDisabled} onChange={handleFile} />
      </label>
    </div>

    {value ? <><Button type="button" disabled={controlsDisabled} className="mt-3 min-h-10 w-full bg-white px-3 py-2 text-sm text-stone-800 ring-1 ring-stone-200" onClick={() => setIsEditingCrop((current) => !current)}><SlidersHorizontal size={17} aria-hidden="true" />{isEditingCrop ? "Cerrar encuadre" : "Editar encuadre"}</Button>{isEditingCrop ? <AnimalPhotoCropEditor value={value} crop={crop} disabled={controlsDisabled} onChange={(nextCrop) => { onCropChange?.(nextCrop); onChange(value, nextCrop); }} /> : null}<Button type="button" disabled={controlsDisabled} className="mt-3 min-h-10 w-full bg-white px-3 py-2 text-sm text-red-900 ring-1 ring-red-100" onClick={() => { setIsEditingCrop(false); onChange(undefined, undefined); }}><Trash2 size={18} aria-hidden="true" />Quitar foto</Button></> : null}
  </section>;
};
