import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Check, ChevronRight, Clock3, HeartPulse, ShieldPlus, Stethoscope } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { db } from "@/db/rejo-db";
import type { Animal, FarmSession, HealthPlanTask } from "@/domain/models";
import { nowInFarmTimezone } from "@/domain/time";
import { AnimalDetail, AnimalEditor } from "@/features/animals/animals-page";
import { createDefaultPreventivePlan } from "@/features/health/default-plan";
import { computeMilkWithholdingUntil, isMilkWithheld } from "@/features/health/milk-withholding";
import { updateHealthPlanTask } from "@/features/health/plan-tasks";

interface HealthWorklistPageProps {
  session: FarmSession;
  onBack: () => void;
}

type TaskAction = "complete" | "postpone" | "ignore";

const taskLabel = (task: HealthPlanTask): string => ({
  brucellosis_vaccination: "Vacuna de brucelosis",
  deworming: "Curada",
  annual_brucellosis_test: "Prueba anual de brucelosis"
})[task.taskType];

const categoryLabel = (category: NonNullable<HealthPlanTask["category"]>): string => ({
  calf: "Terneras",
  heifer: "Vaconas",
  cow: "Vacas"
})[category];

const addDays = (date: string, days: number): string => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const formatFarmDate = (date: string): string => new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Guayaquil"
}).format(new Date(`${date}T12:00:00-05:00`));

const formatFarmDateTime = (value: string): string => new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Guayaquil"
}).format(new Date(value));

const dueLabel = (dueDate: string, today: string): string => {
  if (dueDate === today) return "Para hoy";
  if (dueDate < today) return `Vencida · ${formatFarmDate(dueDate)}`;
  return `Para ${formatFarmDate(dueDate)}`;
};

const taskTargetLabel = (task: HealthPlanTask, animals: Animal[]): string => {
  if (task.animalId) return animals.find((animal) => animal.id === task.animalId)?.name ?? "Animal";
  return task.category ? `Para ${categoryLabel(task.category)}` : "Plan de la finca";
};

const CountChip = ({ label, count }: { label: string; count: number }) => (
  <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-2.5 py-2 text-sm font-bold">
    {label}<strong className="rounded-md bg-white/15 px-1.5 py-0.5 text-xs">{count}</strong>
  </span>
);

const HealthSummary = ({ withheldCount, taskCount, recentEventCount }: { withheldCount: number; taskCount: number; recentEventCount: number }) => {
  const hasWithheldMilk = withheldCount > 0;
  const hasTasks = taskCount > 0;
  const title = hasWithheldMilk
    ? `${withheldCount} ${withheldCount === 1 ? "vaca con leche en retiro" : "vacas con leche en retiro"}`
    : hasTasks
      ? `${taskCount} ${taskCount === 1 ? "tarea por atender" : "tareas por atender"}`
      : "Todo al día";
  const detail = hasWithheldMilk
    ? "No entregar leche. Abre la ficha para revisar el tratamiento y la fecha de entrega."
    : hasTasks
      ? "Revisa las tareas del plan y resuelve solo la que necesites."
      : "No hay leche en retiro ni tareas sanitarias pendientes.";

  return <section className={`rounded-3xl p-5 text-white shadow-[0_14px_30px_rgba(28,25,23,0.16)] ${hasWithheldMilk ? "bg-red-950" : "bg-lime-800"}`} aria-label="Resumen sanitario">
    <div className="flex items-start gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${hasWithheldMilk ? "bg-red-900 text-red-100" : "bg-white/15 text-lime-100"}`}>
        {hasWithheldMilk ? <HeartPulse size={23} aria-hidden="true" /> : <Stethoscope size={23} aria-hidden="true" />}
      </span>
      <div className="min-w-0">
        <p className={`text-xs font-bold uppercase tracking-[0.16em] ${hasWithheldMilk ? "text-red-200" : "text-lime-200"}`}>Sanidad hoy</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">{title}</h2>
        <p className={`mt-1 text-sm leading-snug ${hasWithheldMilk ? "text-red-100" : "text-lime-100"}`}>{detail}</p>
      </div>
    </div>
    <div className={`mt-4 flex flex-wrap gap-2 border-t pt-4 ${hasWithheldMilk ? "border-red-800" : "border-lime-700"}`}>
      <CountChip label="No entregar" count={withheldCount} />
      <CountChip label="Tareas" count={taskCount} />
      <CountChip label="Atenciones 30 d" count={recentEventCount} />
    </div>
  </section>;
};

const TaskActionSheet = ({
  task,
  target,
  today,
  error,
  busyAction,
  onClose,
  onAction
}: {
  task: HealthPlanTask;
  target: string;
  today: string;
  error?: string;
  busyAction?: TaskAction;
  onClose: () => void;
  onAction: (action: TaskAction) => void;
}) => <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-50 px-4 py-5 sm:px-6" role="dialog" aria-modal="true" aria-label={`Gestionar ${taskLabel(task)}`}>
  <div className="mx-auto min-h-full max-w-xl">
    <header className="flex items-center gap-3">
      <Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-800 ring-1 ring-stone-200" onClick={onClose} aria-label="Volver a Sanidad">
        <ArrowLeft size={20} aria-hidden="true" />
      </Button>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-800">Plan sanitario</p>
        <h1 className="text-2xl font-black tracking-tight text-stone-950">Gestionar tarea</h1>
      </div>
    </header>

    <div className="mt-7 space-y-5">
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_8px_28px_rgba(28,25,23,0.06)]">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-800"><ShieldPlus size={22} aria-hidden="true" /></span>
        <h2 className="mt-4 text-2xl font-black text-stone-950">{taskLabel(task)}</h2>
        <p className="mt-1 text-base text-stone-600">{target}</p>
        <div className="mt-5 border-t border-stone-100 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Programada</p>
          <p className={`mt-1 text-base font-black ${task.dueDate < today ? "text-red-800" : "text-stone-950"}`}>{dueLabel(task.dueDate, today)}</p>
        </div>
      </section>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <section aria-labelledby="task-actions-title">
        <p className="px-1 text-sm font-bold uppercase tracking-wide text-stone-500">Resolver</p>
        <h2 id="task-actions-title" className="mt-1 px-1 text-xl font-black text-stone-950">¿Qué pasó con esta tarea?</h2>
        <div className="mt-3 space-y-3">
          <Button type="button" className="w-full bg-lime-700 text-white" disabled={Boolean(busyAction)} onClick={() => onAction("complete")}>
            <Check size={20} aria-hidden="true" />{busyAction === "complete" ? "Guardando…" : "Marcar como hecha"}
          </Button>
          <Button type="button" className="w-full bg-white text-stone-800 ring-1 ring-stone-200" disabled={Boolean(busyAction)} onClick={() => onAction("postpone")}>
            <Clock3 size={20} aria-hidden="true" />{busyAction === "postpone" ? "Guardando…" : "Posponer 7 días"}
          </Button>
          <Button type="button" className="w-full bg-red-50 text-red-900 ring-1 ring-red-100" disabled={Boolean(busyAction)} onClick={() => onAction("ignore")}>
            {busyAction === "ignore" ? "Guardando…" : "Ignorar esta tarea"}
          </Button>
        </div>
      </section>
    </div>
  </div>
</div>;

export const HealthWorklistPage = ({ session, onBack }: HealthWorklistPageProps) => {
  const { date: today } = nowInFarmTimezone();
  const [selectedAnimal, setSelectedAnimal] = useState<Animal>();
  const [editedAnimal, setEditedAnimal] = useState<Animal>();
  const [selectedTask, setSelectedTask] = useState<HealthPlanTask>();
  const [busyAction, setBusyAction] = useState<TaskAction>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const animals = useLiveQuery(
    () => db.animals.filter((item) => item.farmId === session.farmId && !item.deletedAt && item.status === "active").sortBy("name"),
    [session.farmId],
    []
  );
  const groups = useLiveQuery(
    () => db.herdGroups.filter((item) => item.farmId === session.farmId && !item.deletedAt).sortBy("sortOrder"),
    [session.farmId],
    []
  );
  const healthEvents = useLiveQuery(
    () => db.healthEvents.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(),
    [session.farmId],
    []
  );
  const tasks = useLiveQuery(
    () => db.healthPlanTasks.filter((item) => item.farmId === session.farmId && !item.deletedAt && !item.completedAt && !item.ignoredAt).sortBy("dueDate"),
    [session.farmId],
    []
  );
  const withheldAnimals = useMemo(() => animals
    .filter((animal) => animal.sex !== "male")
    .map((animal) => {
      const events = healthEvents.filter((event) => event.animalId === animal.id);
      return { animal, until: computeMilkWithholdingUntil(events), withheld: isMilkWithheld(events, new Date()) };
    })
    .filter((item) => item.withheld), [animals, healthEvents]);
  const recentHealthEvents = healthEvents.filter((event) => event.date >= addDays(today, -30)).length;

  const activatePlan = async () => {
    setMessage(undefined);
    setError(undefined);
    try {
      const created = await createDefaultPreventivePlan(db, { farmId: session.farmId, userId: session.userId, startDate: today });
      setMessage(created.length === 0 ? "El plan sanitario mínimo ya estaba activo." : "El plan sanitario mínimo quedó guardado en el celular.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo activar el plan sanitario.");
    }
  };

  const updateTask = async (task: HealthPlanTask, action: TaskAction) => {
    setMessage(undefined);
    setError(undefined);
    setBusyAction(action);
    try {
      await updateHealthPlanTask(db, task, action);
      setSelectedTask(undefined);
      setMessage(action === "complete" ? "La tarea quedó completada y la siguiente fecha fue programada." : action === "postpone" ? "La tarea se pospuso siete días." : "La tarea quedó ignorada.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar la tarea.");
    } finally {
      setBusyAction(undefined);
    }
  };

  const openEditor = (animal: Animal) => {
    setSelectedAnimal(undefined);
    setEditedAnimal(animal);
  };

  const openTask = (task: HealthPlanTask) => {
    setError(undefined);
    setSelectedTask(task);
  };

  const attentionCount = withheldAnimals.length + tasks.length;

  return <div className="space-y-5">
    <header className="flex items-center gap-3 px-1">
      <Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-800 ring-1 ring-stone-200" onClick={onBack} aria-label="Volver al rejo">
        <ArrowLeft size={20} aria-hidden="true" />
      </Button>
      <h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Sanidad</h1>
    </header>

    {message ? <Notice tone="success">{message}</Notice> : null}
    {!selectedTask && error ? <Notice tone="error">{error}</Notice> : null}

    <HealthSummary withheldCount={withheldAnimals.length} taskCount={tasks.length} recentEventCount={recentHealthEvents} />

    <section aria-labelledby="health-attention-title">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Atención</p>
          <h2 id="health-attention-title" className="mt-1 text-xl font-black text-stone-950">Para atender</h2>
        </div>
        <span className="text-sm font-semibold text-stone-500">{attentionCount === 0 ? "Todo al día" : `${attentionCount} ${attentionCount === 1 ? "pendiente" : "pendientes"}`}</span>
      </div>

      <div className="mt-3 space-y-4">
        {withheldAnimals.length > 0 ? <section aria-labelledby="withheld-milk-title">
          <p id="withheld-milk-title" className="px-1 text-sm font-bold uppercase tracking-wide text-red-800">Leche en retiro</p>
          <div className="mt-2 overflow-hidden rounded-3xl border border-red-200 bg-white shadow-[0_8px_28px_rgba(28,25,23,0.06)]">
            {withheldAnimals.map((item, index) => <button key={item.animal.id} type="button" aria-label={`Abrir ficha de ${item.animal.name}: no entregar leche`} className={`flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-red-50 active:bg-red-50 sm:px-5 ${index ? "border-t border-red-100" : ""}`} onClick={() => setSelectedAnimal(item.animal)}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-800"><HeartPulse size={20} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="truncate text-base font-black text-stone-950">{item.animal.name}</span><span className="shrink-0 text-xs font-bold text-red-800">No entregar</span></span>
                <span className="mt-1 block text-sm leading-snug text-stone-600">Hasta {item.until ? formatFarmDateTime(item.until) : "nuevo aviso"}</span>
              </span>
              <ChevronRight className="shrink-0 text-red-400" size={20} aria-hidden="true" />
            </button>)}
          </div>
        </section> : null}

        {tasks.length > 0 ? <section aria-labelledby="health-plan-title">
          <p id="health-plan-title" className="flex items-center gap-1.5 px-1 text-sm font-bold uppercase tracking-wide text-stone-500"><ShieldPlus size={16} aria-hidden="true" />Plan sanitario</p>
          <div className="mt-2 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_8px_28px_rgba(28,25,23,0.06)]">
            {tasks.map((task, index) => <button key={task.id} type="button" aria-label={`Gestionar ${taskLabel(task)}`} className={`flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50 active:bg-lime-50 sm:px-5 ${index ? "border-t border-stone-100" : ""}`} onClick={() => openTask(task)}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800"><Clock3 size={20} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="truncate text-base font-black text-stone-950">{taskLabel(task)}</span><span className={`shrink-0 text-xs font-bold ${task.dueDate < today ? "text-red-800" : "text-amber-800"}`}>{task.dueDate < today ? "Vencida" : task.dueDate === today ? "Hoy" : "Programada"}</span></span>
                <span className="mt-1 block text-sm leading-snug text-stone-600">{taskTargetLabel(task, animals)} · {dueLabel(task.dueDate, today)}</span>
              </span>
              <ChevronRight className="shrink-0 text-stone-400" size={20} aria-hidden="true" />
            </button>)}
          </div>
        </section> : null}

        {attentionCount === 0 ? <section className="rounded-3xl border border-lime-200 bg-lime-50 p-4 text-lime-950">
          <p className="font-black">No hay nada urgente por atender.</p>
          <p className="mt-1 text-sm leading-snug">Cuando haya una curada pendiente o leche en retiro, aparecerá primero aquí.</p>
        </section> : null}
      </div>
    </section>

    {tasks.length === 0 ? <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-[0_8px_28px_rgba(28,25,23,0.06)]" aria-labelledby="prepare-health-plan-title">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-50 text-lime-800"><ShieldPlus size={20} aria-hidden="true" /></span><div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Plan sanitario</p><h2 id="prepare-health-plan-title" className="mt-1 text-lg font-black text-stone-950">Preparar recordatorios</h2><p className="mt-1 text-sm leading-snug text-stone-600">Activa la guía mínima de curadas y prueba anual de brucelosis.</p></div></div>
      <Button type="button" className="mt-4 w-full bg-stone-900 text-white" onClick={() => void activatePlan()}><ShieldPlus size={20} aria-hidden="true" />Activar plan sanitario</Button>
    </section> : null}

    {selectedTask ? <TaskActionSheet task={selectedTask} target={taskTargetLabel(selectedTask, animals)} today={today} error={error} busyAction={busyAction} onClose={() => { setSelectedTask(undefined); setError(undefined); }} onAction={(action) => void updateTask(selectedTask, action)} /> : null}
    {selectedAnimal ? <AnimalDetail animal={selectedAnimal} groups={groups} session={session} initialSection="health" onClose={() => setSelectedAnimal(undefined)} onEdit={() => openEditor(selectedAnimal)} /> : null}
    {editedAnimal ? <AnimalEditor animal={editedAnimal} groups={groups} session={session} onClose={() => setEditedAnimal(undefined)} onSaved={(nextMessage) => { setEditedAnimal(undefined); setMessage(nextMessage); }} /> : null}
  </div>;
};
