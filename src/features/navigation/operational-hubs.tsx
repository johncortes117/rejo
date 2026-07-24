import { Beef, ChevronRight, ClipboardPenLine, HeartPulse, Settings2, ShieldPlus, Sprout } from "lucide-react";

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

const DestinationCard = ({
  title,
  description,
  action,
  icon: Icon,
  onClick,
  tone = "lime"
}: {
  title: string;
  description: string;
  action: string;
  icon: typeof Beef;
  onClick: () => void;
  tone?: "lime" | "stone" | "sky" | "rose";
}) => {
  const toneStyles = {
    lime: "border-lime-200 bg-lime-50 hover:bg-lime-100",
    stone: "border-stone-200 bg-white hover:bg-stone-50",
    sky: "border-sky-200 bg-sky-50 hover:bg-sky-100",
    rose: "border-rose-200 bg-rose-50 hover:bg-rose-100"
  };

  return (
    <button
      type="button"
      className={`flex min-h-28 w-full items-center gap-4 rounded-3xl border p-4 text-left shadow-[0_8px_28px_rgba(28,25,23,0.05)] transition active:scale-[0.99] ${toneStyles[tone]}`}
      onClick={onClick}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-lime-800 shadow-sm">
        <Icon size={24} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-black text-stone-950">{title}</span>
        <span className="mt-1 block text-sm leading-snug text-stone-600">{description}</span>
        <span className="mt-2 block text-sm font-bold text-lime-800">{action}</span>
      </span>
      <ChevronRight className="shrink-0 text-stone-400" size={22} aria-hidden="true" />
    </button>
  );
};

export const HerdHubPage = ({ onAnimals, onReproduction, onHealth, onMilkControl }: HerdHubPageProps) => (
  <div className="space-y-5">
    <header className="px-1">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-lime-800">Operación animal</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">El rejo</h1>
      <p className="mt-2 max-w-xl text-base text-stone-600">Elige qué necesitas revisar o registrar.</p>
    </header>

    <section className="space-y-3" aria-label="Secciones del rejo">
      <DestinationCard
        title="Animales"
        description="Consulta los grupos y abre la ficha de cada animal."
        action="Ver grupos"
        icon={Beef}
        onClick={onAnimals}
      />
      <DestinationCard
        title="Reproducción"
        description="Registra celos, servicios, preñeces y partos desde la ficha correspondiente."
        action="Abrir fichas"
        icon={HeartPulse}
        onClick={onReproduction}
        tone="rose"
      />
      <DestinationCard
        title="Sanidad"
        description="Anota atenciones y revisa cuándo la leche no se puede entregar."
        action="Abrir fichas"
        icon={ShieldPlus}
        onClick={onHealth}
        tone="sky"
      />
      <DestinationCard
        title="Control lechero"
        description="Compara los litros por vaca cuando hagas el control mensual."
        action="Ver control"
        icon={ClipboardPenLine}
        onClick={onMilkControl}
        tone="stone"
      />
    </section>
  </div>
);

export const MorePage = ({ onPaddocks, onSettings }: MorePageProps) => (
  <div className="space-y-5">
    <header className="px-1">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-lime-800">La finca</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Más</h1>
      <p className="mt-2 max-w-xl text-base text-stone-600">Módulos y ajustes que no necesitas abrir todos los días.</p>
    </header>

    <section className="space-y-3" aria-label="Más opciones de la finca">
      <DestinationCard
        title="Potreros"
        description="Revisa la rotación, los lotes y el descanso de cada potrero."
        action="Ver potreros"
        icon={Sprout}
        onClick={onPaddocks}
      />
      <DestinationCard
        title="Configuración"
        description="Actualiza los datos permanentes de la finca, comprador y tanque."
        action="Abrir configuración"
        icon={Settings2}
        onClick={onSettings}
        tone="stone"
      />
    </section>
  </div>
);
