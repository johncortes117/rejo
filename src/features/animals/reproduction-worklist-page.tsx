import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, CalendarDays, ChevronRight, CircleCheck, HeartPulse, Repeat2 } from "lucide-react";
import { Button, Notice, SegmentedControl } from "@/components/ui";
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

type ReproductionView = "pending" | "all";

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

const formatDate = (value: string) => new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "America/Guayaquil" }).format(new Date(`${value}T12:00:00-05:00`));

const rowDetail = ({ state, calvingSoon }: AnimalReproductionState): string => {
  if (state.isRepeatBreeder) return "Repetidora: conviene revisarla.";
  if (state.status === "in_heat") return "Abre la ficha para anotar el servicio.";
  if (state.status === "pregnant_presumed") return "Ya se puede confirmar la preñez.";
  if (calvingSoon && state.expectedCalvingDate) return `Parto estimado: ${formatDate(state.expectedCalvingDate)}.`;
  if (state.expectedCalvingDate) return `Parto estimado: ${formatDate(state.expectedCalvingDate)}.`;
  return "Abre la ficha para registrar el siguiente evento.";
};

const rowTone = (item: AnimalReproductionState) => {
  if (item.state.isRepeatBreeder || item.state.status === "in_heat") return { icon: "bg-rose-100 text-rose-950", status: "text-rose-900" };
  if (item.state.status === "pregnant_presumed") return { icon: "bg-amber-100 text-amber-950", status: "text-amber-900" };
  if (item.calvingSoon) return { icon: "bg-sky-100 text-sky-950", status: "text-sky-900" };
  if (item.state.status === "pregnant_confirmed") return { icon: "bg-lime-100 text-lime-950", status: "text-lime-900" };
  return { icon: "bg-stone-100 text-stone-700", status: "text-stone-700" };
};

const ReproductionSummary = ({ animalCount, attentionCount, heatCount, confirmationCount, calvingSoonCount, repeatBreederCount }: {
  animalCount: number;
  attentionCount: number;
  heatCount: number;
  confirmationCount: number;
  calvingSoonCount: number;
  repeatBreederCount: number;
}) => {
  if (animalCount === 0) {
    return <section className="flex items-center gap-3 rounded-3xl border border-stone-200 bg-white p-4 shadow-[0_8px_28px_rgba(28,25,23,0.06)]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-700"><HeartPulse size={22} aria-hidden="true" /></span><div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Reproducción</p><h2 className="mt-1 text-xl font-black text-stone-950">Aún no hay vacas registradas</h2></div></section>;
  }

  if (attentionCount === 0) {
    return <section className="flex items-center gap-3 rounded-3xl bg-lime-50 p-4 text-lime-950 ring-1 ring-lime-200"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white"><CircleCheck size={23} aria-hidden="true" /></span><div><p className="text-sm font-bold uppercase tracking-wide text-lime-800">Reproducción al día</p><h2 className="mt-1 text-xl font-black">Sin pendientes ahora</h2><p className="mt-1 text-sm leading-snug text-lime-900">No hay celos, confirmaciones ni partos próximos para revisar.</p></div></section>;
  }

  const signals = [
    { label: "En celo", count: heatCount, icon: HeartPulse },
    { label: "Confirmar preñez", count: confirmationCount, icon: HeartPulse },
    { label: "Partos cerca", count: calvingSoonCount, icon: CalendarDays },
    { label: "Repetidoras", count: repeatBreederCount, icon: Repeat2 }
  ].filter((signal) => signal.count > 0);

  return <section className="rounded-3xl bg-lime-800 p-5 text-white shadow-[0_14px_30px_rgba(77,124,15,0.22)]" aria-label="Resumen de reproducción"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-rose-100"><HeartPulse size={23} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-200">Reproducción hoy</p><h2 className="mt-1 text-2xl font-black tracking-tight">{attentionCount} {attentionCount === 1 ? "animal por revisar" : "animales por revisar"}</h2><p className="mt-1 text-sm leading-snug text-lime-100">Abre la ficha del animal para registrar o confirmar el evento.</p></div></div><div className="mt-4 flex flex-wrap gap-2 border-t border-lime-700 pt-4">{signals.map(({ label, count, icon: Icon }) => <span key={label} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-2.5 py-2 text-sm font-bold"><Icon size={16} aria-hidden="true" />{label}<strong className="ml-0.5 rounded-md bg-white/15 px-1.5 py-0.5 text-xs">{count}</strong></span>)}</div></section>;
};

export const ReproductionWorklistPage = ({ session, onBack }: ReproductionWorklistPageProps) => {
  const { date: today } = nowInFarmTimezone();
  const [view, setView] = useState<ReproductionView>("pending");
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
  const visibleRows = view === "all" ? animalStates : attentionRows;
  const heatCount = animalStates.filter((item) => item.state.status === "in_heat").length;
  const confirmationCount = animalStates.filter((item) => item.state.status === "pregnant_presumed").length;
  const calvingSoonCount = animalStates.filter((item) => item.calvingSoon).length;
  const repeatBreederCount = animalStates.filter((item) => item.state.isRepeatBreeder).length;
  const listTitle = view === "pending" ? "Pendientes" : "Todas las vacas";
  const listDetail = view === "pending" ? (attentionRows.length === 0 ? "No hay nada pendiente ahora" : `${attentionRows.length} ${attentionRows.length === 1 ? "animal requiere atención" : "animales requieren atención"}`) : `${animalStates.length} ${animalStates.length === 1 ? "animal activo" : "animales activos"}`;

  const openEditor = (animal: Animal) => {
    setSelectedAnimal(undefined);
    setEditedAnimal(animal);
  };

  return <div className="space-y-5"><header className="flex items-center gap-3 px-1"><Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-800 ring-1 ring-stone-200" onClick={onBack} aria-label="Volver al rejo"><ArrowLeft size={20} aria-hidden="true" /></Button><h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Reproducción</h1></header>{message ? <Notice tone="success">{message}</Notice> : null}<ReproductionSummary animalCount={animalStates.length} attentionCount={attentionRows.length} heatCount={heatCount} confirmationCount={confirmationCount} calvingSoonCount={calvingSoonCount} repeatBreederCount={repeatBreederCount} /><SegmentedControl ariaLabel="Vista de reproducción" value={view} onChange={setView} options={[{ id: "pending", ariaLabel: `Ver ${attentionRows.length} pendientes`, label: <span className="inline-flex items-center gap-1.5">Pendientes <span className="rounded-md bg-stone-200 px-1.5 py-0.5 text-xs text-stone-700">{attentionRows.length}</span></span> }, { id: "all", ariaLabel: `Ver las ${animalStates.length} vacas`, label: <span className="inline-flex items-center gap-1.5">Todas <span className="rounded-md bg-stone-200 px-1.5 py-0.5 text-xs text-stone-700">{animalStates.length}</span></span> }]} /><section><div className="flex items-end justify-between gap-3 px-1"><div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Rejo</p><h2 className="mt-1 text-xl font-black text-stone-950">{listTitle}</h2></div><span className="text-sm font-semibold text-stone-500">{listDetail}</span></div><div className="mt-3">{animals.length === 0 ? <Notice tone="info">Registra las vacas primero para organizar la reproducción.</Notice> : visibleRows.length === 0 ? <section className="rounded-3xl border border-lime-200 bg-lime-50 p-4 text-lime-950"><p className="font-black">Todo al día</p><p className="mt-1 text-sm leading-snug">Cuando aparezca un celo, una confirmación o un parto próximo, lo verás aquí.</p></section> : <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_8px_28px_rgba(28,25,23,0.06)]">{visibleRows.map((item, index) => { const Icon = item.state.isRepeatBreeder ? Repeat2 : item.calvingSoon ? CalendarDays : HeartPulse; const tone = rowTone(item); return <button key={item.animal.id} type="button" aria-label={`Abrir ficha de ${item.animal.name}: ${statusLabel[item.state.status]}`} className={`flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50 active:bg-lime-50 sm:px-5 ${index ? "border-t border-stone-100" : ""}`} onClick={() => setSelectedAnimal(item.animal)}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}><Icon size={20} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-base font-black text-stone-950">{item.animal.name}</span><span className={`shrink-0 text-xs font-bold ${tone.status}`}>{statusLabel[item.state.status]}</span></span><span className="mt-1 block text-sm leading-snug text-stone-600">{rowDetail(item)}</span></span><ChevronRight className="shrink-0 text-stone-400" size={20} aria-hidden="true" /></button>; })}</section>}</div></section>{selectedAnimal ? <AnimalDetail animal={selectedAnimal} groups={groups} session={session} initialSection="reproduction" onClose={() => setSelectedAnimal(undefined)} onEdit={() => openEditor(selectedAnimal)} /> : null}{editedAnimal ? <AnimalEditor animal={editedAnimal} groups={groups} session={session} onClose={() => setEditedAnimal(undefined)} onSaved={(nextMessage) => { setEditedAnimal(undefined); setMessage(nextMessage); }} /> : null}</div>;
};
