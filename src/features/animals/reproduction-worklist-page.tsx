import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, CalendarDays, ChevronRight, HeartPulse, Repeat2 } from "lucide-react";
import { Button, Card, Notice } from "@/components/ui";
import { db } from "@/db/rejo-db";
import type { Animal, FarmSession } from "@/domain/models";
import { nowInFarmTimezone } from "@/domain/time";
import { AnimalDetail, AnimalEditor } from "@/features/animals/animals-page";
import { computeReproductiveState, type ReproductiveState } from "@/features/reproduction/reproductive-state";

interface ReproductionWorklistPageProps {
  session: FarmSession;
  onBack: () => void;
}

interface AnimalReproductionState {
  animal: Animal;
  state: ReproductiveState;
  needsAttention: boolean;
  calvingSoon: boolean;
}

const statusLabel: Record<ReproductiveState["status"], string> = {
  open: "Vacía",
  in_heat: "En celo",
  served: "Servida",
  pregnant_presumed: "Confirmar preñez",
  pregnant_confirmed: "Preñez confirmada",
  fresh: "Recién parida",
  not_applicable: "No aplica"
};

const dayDifference = (from: string, to: string): number => {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000);
};

const rowDetail = ({ state, calvingSoon }: AnimalReproductionState): string => {
  if (state.isRepeatBreeder) return "Repetidora: conviene revisarla.";
  if (state.status === "in_heat") return "Celo registrado; abre la ficha para anotar el servicio.";
  if (state.status === "pregnant_presumed") return "Ya se puede confirmar la preñez.";
  if (calvingSoon && state.expectedCalvingDate) return `Parto estimado: ${state.expectedCalvingDate}.`;
  if (state.expectedCalvingDate) return `Parto estimado: ${state.expectedCalvingDate}.`;
  return "Abre la ficha para registrar el siguiente evento.";
};

export const ReproductionWorklistPage = ({ session, onBack }: ReproductionWorklistPageProps) => {
  const { date: today } = nowInFarmTimezone();
  const [showAll, setShowAll] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal>();
  const [editedAnimal, setEditedAnimal] = useState<Animal>();
  const [message, setMessage] = useState<string>();
  const animals = useLiveQuery(
    () => db.animals.filter((item) => item.farmId === session.farmId && !item.deletedAt && item.status === "active" && item.sex !== "male").sortBy("name"),
    [session.farmId],
    []
  );
  const groups = useLiveQuery(
    () => db.herdGroups.filter((item) => item.farmId === session.farmId && !item.deletedAt).sortBy("sortOrder"),
    [session.farmId],
    []
  );
  const facts = useLiveQuery(
    async () => Promise.all([
      db.heats.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(),
      db.services.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(),
      db.pregnancyChecks.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(),
      db.calvings.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray()
    ]),
    [session.farmId],
    [[], [], [], []]
  );
  const [heats, services, pregnancyChecks, calvings] = facts;
  const animalStates = useMemo<AnimalReproductionState[]>(() => animals.map((animal) => {
    const state = computeReproductiveState({
      asOf: today,
      sex: animal.sex,
      heats: heats.filter((item) => item.animalId === animal.id),
      services: services.filter((item) => item.animalId === animal.id),
      pregnancyChecks: pregnancyChecks.filter((item) => item.animalId === animal.id),
      calvings: calvings.filter((item) => item.animalId === animal.id)
    });
    const daysUntilCalving = state.expectedCalvingDate ? dayDifference(today, state.expectedCalvingDate) : undefined;
    const calvingSoon = daysUntilCalving !== undefined && daysUntilCalving >= 0 && daysUntilCalving <= 30;
    const needsAttention = state.isRepeatBreeder || state.status === "in_heat" || state.status === "pregnant_presumed" || calvingSoon;
    return { animal, state, needsAttention, calvingSoon };
  }).sort((left, right) => Number(right.needsAttention) - Number(left.needsAttention) || left.animal.name.localeCompare(right.animal.name)), [animals, calvings, heats, pregnancyChecks, services, today]);
  const attentionRows = animalStates.filter((item) => item.needsAttention);
  const visibleRows = showAll ? animalStates : attentionRows;
  const heatCount = animalStates.filter((item) => item.state.status === "in_heat").length;
  const confirmationCount = animalStates.filter((item) => item.state.status === "pregnant_presumed").length;
  const calvingSoonCount = animalStates.filter((item) => item.calvingSoon).length;

  const openEditor = (animal: Animal) => {
    setSelectedAnimal(undefined);
    setEditedAnimal(animal);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Button type="button" className="shrink-0 bg-white px-4 text-stone-800 ring-1 ring-stone-200" onClick={onBack} aria-label="Volver al rejo">
          <ArrowLeft size={20} aria-hidden="true" />
        </Button>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.16em] text-lime-800"><HeartPulse size={16} aria-hidden="true" />El rejo</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">Reproducción</h1>
          <p className="mt-2 text-base text-stone-600">Primero mira qué animales requieren atención; después abre su ficha para registrar el evento.</p>
        </div>
      </header>

      {message ? <Notice tone="success">{message}</Notice> : null}

      <section className="grid grid-cols-3 gap-3" aria-label="Resumen de reproducción">
        <Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">En celo</p><p className="mt-1 text-3xl font-black text-stone-950">{heatCount}</p></Card>
        <Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Confirmar</p><p className="mt-1 text-3xl font-black text-stone-950">{confirmationCount}</p></Card>
        <Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Partos cerca</p><p className="mt-1 text-3xl font-black text-stone-950">{calvingSoonCount}</p></Card>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 px-1">
          <div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Para revisar</p><h2 className="mt-1 text-2xl font-black text-stone-950">{attentionRows.length === 0 ? "Todo al día" : `${attentionRows.length} por atender`}</h2></div>
          {animalStates.length > attentionRows.length ? <button type="button" className="min-h-11 rounded-xl px-3 text-sm font-bold text-lime-800 underline" aria-expanded={showAll} onClick={() => setShowAll((current) => !current)}>{showAll ? "Ver pendientes" : `Ver las ${animalStates.length}`}</button> : null}
        </div>
        <div className="mt-3 space-y-3">
          {animals.length === 0 ? <Notice tone="info">Registra las vacas primero para organizar la reproducción.</Notice> : visibleRows.length === 0 ? <Notice tone="success">No hay celos, confirmaciones de preñez ni partos próximos para revisar.</Notice> : visibleRows.map((item) => <button key={item.animal.id} type="button" className="flex min-h-24 w-full items-center gap-3 rounded-3xl border border-stone-200 bg-white p-4 text-left shadow-[0_8px_28px_rgba(28,25,23,0.05)] transition hover:bg-lime-50 active:scale-[0.99]" onClick={() => setSelectedAnimal(item.animal)}><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.needsAttention ? "bg-rose-100 text-rose-950" : "bg-stone-100 text-stone-700"}`}>{item.state.isRepeatBreeder ? <Repeat2 size={21} aria-hidden="true" /> : item.calvingSoon ? <CalendarDays size={21} aria-hidden="true" /> : <HeartPulse size={21} aria-hidden="true" />}</span><span className="min-w-0 flex-1"><span className="block text-lg font-black text-stone-950">{item.animal.name}</span><span className="mt-0.5 block text-sm font-bold text-lime-800">{statusLabel[item.state.status]}</span><span className="mt-1 block text-sm leading-snug text-stone-600">{rowDetail(item)}</span></span><ChevronRight className="shrink-0 text-stone-400" size={22} aria-hidden="true" /></button>)}</div>
      </section>

      {selectedAnimal ? <AnimalDetail animal={selectedAnimal} groups={groups} session={session} initialSection="reproduction" onClose={() => setSelectedAnimal(undefined)} onEdit={() => openEditor(selectedAnimal)} /> : null}
      {editedAnimal ? <AnimalEditor animal={editedAnimal} groups={groups} session={session} onClose={() => setEditedAnimal(undefined)} onSaved={(nextMessage) => { setEditedAnimal(undefined); setMessage(nextMessage); }} /> : null}
    </div>
  );
};
