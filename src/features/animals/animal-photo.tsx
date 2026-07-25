import { type ChangeEvent, useId, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { prepareAnimalPhoto } from "@/features/animals/animal-photo-utils";

export const AnimalAvatar = ({
  name,
  photoUrl,
  size = "row"
}: {
  name: string;
  photoUrl?: string;
  size?: "row" | "detail" | "preview";
}) => {
  const sizeClasses = {
    row: "h-10 w-10 rounded-xl text-base",
    detail: "h-16 w-16 rounded-2xl text-2xl",
    preview: "h-24 w-24 rounded-2xl text-3xl"
  }[size];

  return <span className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-lime-100 font-black text-lime-950 ${sizeClasses}`}>
    <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
    {photoUrl ? <img className="absolute inset-0 h-full w-full object-cover" src={photoUrl} alt={`Foto de ${name}`} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
  </span>;
};

export const AnimalPhotoPicker = ({
  value,
  animalName,
  disabled = false,
  onChange,
  onPreparingChange
}: {
  value?: string;
  animalName: string;
  disabled?: boolean;
  onChange: (value?: string) => void;
  onPreparingChange?: (isPreparing: boolean) => void;
}) => {
  const cameraInputId = useId();
  const galleryInputId = useId();
  const [isPreparing, setIsPreparing] = useState(false);
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
      onChange(await prepareAnimalPhoto(file));
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
      <AnimalAvatar name={animalName || "?"} photoUrl={value} size="preview" />
      <div className="min-w-0 flex-1">
        <p className="font-black text-stone-950">Foto de la vaca <span className="font-medium text-stone-500">(opcional)</span></p>
        <p className="mt-1 text-sm leading-snug text-stone-600">Ayuda a reconocerla rápido en la lista.</p>
        {isPreparing ? <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-lime-800" role="status"><LoaderCircle className="animate-spin" size={16} aria-hidden="true" />Preparando foto…</p> : null}
      </div>
    </div>

    {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-900" role="alert">{error}</p> : null}

    <div className="mt-4 grid grid-cols-2 gap-2">
      <label htmlFor={cameraInputId} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime-700 px-3 py-2 text-sm font-bold text-white transition ${controlsDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-[0.98]"}`}>
        <Camera size={18} aria-hidden="true" />Tomar foto
        <input id={cameraInputId} className="sr-only" type="file" accept="image/*" capture="environment" aria-label="Tomar foto de la vaca" disabled={controlsDisabled} onChange={handleFile} />
      </label>
      <label htmlFor={galleryInputId} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-stone-800 ring-1 ring-stone-200 transition ${controlsDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-[0.98]"}`}>
        <ImagePlus size={18} aria-hidden="true" />Elegir foto
        <input id={galleryInputId} className="sr-only" type="file" accept="image/*" aria-label="Elegir foto de la vaca" disabled={controlsDisabled} onChange={handleFile} />
      </label>
    </div>

    {value ? <Button type="button" disabled={controlsDisabled} className="mt-3 min-h-10 w-full bg-white px-3 py-2 text-sm text-red-900 ring-1 ring-red-100" onClick={() => onChange(undefined)}><Trash2 size={18} aria-hidden="true" />Quitar foto</Button> : null}
  </section>;
};
