import { Beef, ClipboardPenLine, HeartPulse, Settings2, ShieldPlus, Sprout } from "lucide-react";

interface HerdHubPageProps {
  onAnimals: () => void;
  onReproduction: () => void;
  onHealth: () => void;
  onMilkControl: () => void;
}

interface MorePageProps {
  onPaddocks: () => void;
  onSettings: () => void;
}

const DestinationTile = ({
  title,
  detail,
  icon: Icon,
  onClick,
  tone = "lime"
}: {
  title: string;
  detail: string;
  icon: typeof Beef;
  onClick: () => void;
  tone?: "lime" | "stone" | "sky" | "rose";
}) => {
  const toneStyles = {
    lime: "border-lime-200 bg-lime-50 text-lime-950",
    stone: "border-stone-200 bg-white text-stone-950",
    sky: "border-sky-200 bg-sky-50 text-sky-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950"
  };

  return <button type="button" aria-label={title} className={`flex min-h-32 flex-col items-start justify-between rounded-3xl border p-4 text-left shadow-[0_8px_28px_rgba(28,25,23,0.05)] transition active:scale-[0.98] ${toneStyles[tone]}`} onClick={onClick}>
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-stone-900 shadow-sm"><Icon size={21} aria-hidden="true" /></span>
    <span><span className="block text-lg font-black leading-tight">{title}</span><span className="mt-1 block text-sm leading-snug text-stone-600">{detail}</span></span>
  </button>;
};

export const HerdHubPage = ({ onAnimals, onReproduction, onHealth, onMilkControl }: HerdHubPageProps) => (
  <div className="space-y-5">
    <header className="px-1"><h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">El rejo</h1></header>
    <section aria-labelledby="herd-actions-title"><p className="px-1 text-sm font-bold uppercase tracking-wide text-stone-500">Operación animal</p><h2 id="herd-actions-title" className="mt-1 px-1 text-xl font-black text-stone-950">¿Qué necesitas?</h2><div className="mt-3 grid grid-cols-2 gap-3"><DestinationTile title="Animales" detail="Grupos y fichas" icon={Beef} onClick={onAnimals} /><DestinationTile title="Reproducción" detail="Celos y partos" icon={HeartPulse} onClick={onReproduction} tone="rose" /><DestinationTile title="Sanidad" detail="Curadas y tratamientos" icon={ShieldPlus} onClick={onHealth} tone="sky" /><DestinationTile title="Control lechero" detail="Litros por vaca" icon={ClipboardPenLine} onClick={onMilkControl} tone="stone" /></div></section>
  </div>
);

export const MorePage = ({ onPaddocks, onSettings }: MorePageProps) => (
  <div className="space-y-5">
    <header className="px-1"><h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Más</h1></header>
    <section aria-labelledby="farm-actions-title"><p className="px-1 text-sm font-bold uppercase tracking-wide text-stone-500">La finca</p><h2 id="farm-actions-title" className="mt-1 px-1 text-xl font-black text-stone-950">Administrar</h2><div className="mt-3 grid grid-cols-2 gap-3"><DestinationTile title="Potreros" detail="Rotación y lotes" icon={Sprout} onClick={onPaddocks} tone="sky" /><DestinationTile title="Configuración" detail="Finca y tanque" icon={Settings2} onClick={onSettings} tone="stone" /></div></section>
  </div>
);
